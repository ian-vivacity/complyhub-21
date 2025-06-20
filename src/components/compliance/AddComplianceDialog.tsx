
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from './FileUpload';
import { useTeamMembers } from '@/hooks/useTeamMembers';

interface AddComplianceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Standard {
  id: string;
  standard_clause: string;
  standard_description: string;
}

export const AddComplianceDialog = ({ open, onOpenChange, onSuccess }: AddComplianceDialogProps) => {
  const { organisationMember } = useAuth();
  const { toast } = useToast();
  const { teamMembers } = useTeamMembers();
  const [complianceItem, setComplianceItem] = useState('');
  const [standardClause, setStandardClause] = useState('');
  const [complianceStatus, setComplianceStatus] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState<Date>();
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [standards, setStandards] = useState<Standard[]>([]);
  const [standardsLoading, setStandardsLoading] = useState(true);

  const isAdmin = organisationMember?.role === 'admin';
  const memberName = organisationMember?.full_name || organisationMember?.email || '';

  // Fetch standards when dialog opens
  useEffect(() => {
    if (open && organisationMember?.organisation_id) {
      fetchStandards();
    }
  }, [open, organisationMember?.organisation_id]);

  const fetchStandards = async () => {
    if (!organisationMember?.organisation_id) return;

    try {
      setStandardsLoading(true);
      const { data, error } = await supabase
        .from('standards')
        .select('*')
        .eq('organisation_id', organisationMember.organisation_id)
        .order('standard_clause', { ascending: true });

      if (error) throw error;
      setStandards(data || []);
    } catch (error) {
      console.error('Error fetching standards:', error);
      toast({
        title: "Error",
        description: "Failed to fetch standards",
        variant: "destructive",
      });
    } finally {
      setStandardsLoading(false);
    }
  };

  const createStorageBucket = async () => {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === 'compliance-evidence');
      
      if (!bucketExists) {
        console.log('Creating compliance-evidence bucket...');
        const { error } = await supabase.storage.createBucket('compliance-evidence', {
          public: true,
          allowedMimeTypes: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        });
        
        if (error) {
          console.error('Error creating bucket:', error);
          throw error;
        }
        console.log('Bucket created successfully');
      }
    } catch (error) {
      console.error('Error with storage bucket:', error);
      // Don't throw here, continue with upload attempt
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisationMember?.organisation_id) {
      toast({
        title: "Error",
        description: "Organisation not found",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Ensure storage bucket exists
      await createStorageBucket();

      let fileNames: string[] = [];
      let filePaths: string[] = [];

      // Upload files if any
      if (files.length > 0) {
        console.log('Uploading files:', files.length);
        
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `${organisationMember.organisation_id}/${fileName}`;

          console.log('Uploading file to path:', filePath);

          const { data, error: uploadError } = await supabase.storage
            .from('compliance-evidence')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload file ${file.name}: ${uploadError.message}`);
          }

          console.log('Upload successful:', data);
          fileNames.push(file.name);
          filePaths.push(filePath);
        }
      }

      // For members, use their name; for admins, use selected person
      const finalResponsiblePerson = isAdmin ? responsiblePerson : memberName;

      if (!finalResponsiblePerson) {
        throw new Error('Responsible person is required');
      }

      console.log('Inserting compliance record with files:', {
        file_names: fileNames,
        file_paths: filePaths
      });

      const { data, error } = await supabase
        .from('compliance_records')
        .insert({
          compliance_item: complianceItem,
          standard_clause: standardClause,
          compliance_status: complianceStatus,
          responsible_person: finalResponsiblePerson,
          next_review_date: nextReviewDate?.toISOString().split('T')[0] || null,
          notes: notes || null,
          organisation_id: organisationMember.organisation_id,
          file_name: fileNames.length > 0 ? fileNames.join(', ') : null,
          file_path: filePaths.length > 0 ? filePaths.join(', ') : null,
        })
        .select();

      if (error) {
        console.error('Database error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('Record inserted successfully:', data);

      toast({
        title: "Success",
        description: `Compliance record added successfully${files.length > 0 ? ` with ${files.length} file(s)` : ''}`,
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error adding compliance record:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add compliance record",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setComplianceItem('');
    setStandardClause('');
    setComplianceStatus('');
    setResponsiblePerson('');
    setNextReviewDate(undefined);
    setNotes('');
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add New Compliance Record</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="complianceItem">Compliance Item</Label>
            <Input
              id="complianceItem"
              placeholder="Enter compliance item"
              value={complianceItem}
              onChange={(e) => setComplianceItem(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="standardClause">Standard Clause</Label>
            <Select value={standardClause} onValueChange={setStandardClause}>
              <SelectTrigger>
                <SelectValue placeholder={standardsLoading ? "Loading standards..." : "Select standard clause"} />
              </SelectTrigger>
              <SelectContent>
                {standards.map((standard) => (
                  <SelectItem key={standard.id} value={standard.standard_clause}>
                    {standard.standard_clause} - {standard.standard_description}
                  </SelectItem>
                ))}
                {standards.length === 0 && !standardsLoading && (
                  <SelectItem value="" disabled>No standards available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="complianceStatus">Compliance Status</Label>
            <Select value={complianceStatus} onValueChange={setComplianceStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select compliance status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Compliant">Compliant</SelectItem>
                <SelectItem value="At Risk">At Risk</SelectItem>
                <SelectItem value="Non-Compliant">Non-Compliant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="responsiblePerson">Responsible Person</Label>
            {isAdmin ? (
              <Select value={responsiblePerson} onValueChange={setResponsiblePerson}>
                <SelectTrigger>
                  <SelectValue placeholder="Select responsible person" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.full_name || member.email}>
                      {member.full_name || member.email} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="responsiblePerson"
                value={memberName}
                readOnly
                className="bg-gray-100"
                placeholder="Your name will be used"
              />
            )}
          </div>
          
          <div>
            <Label>Next Review Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !nextReviewDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {nextReviewDate ? format(nextReviewDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={nextReviewDate}
                  onSelect={setNextReviewDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Enter any additional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <FileUpload files={files} onFilesChange={setFiles} />
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !complianceItem || !standardClause || !complianceStatus || (isAdmin && !responsiblePerson)}
            >
              {loading ? 'Adding...' : 'Add Record'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
