
import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, User, Mail, Phone, Shield, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { EditProfileDialog } from '@/components/profile/EditProfileDialog';

export const ProfileSettings = () => {
  const { user, organisationMember } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;

      console.log('Uploading file:', fileName);

      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrlData.publicUrl);

      setAvatarUrl(publicUrlData.publicUrl);

      // Update user metadata with avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrlData.publicUrl }
      });

      if (updateError) {
        console.error('Update user error:', updateError);
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Avatar updated successfully!",
      });

    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload avatar. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-medium inline-flex items-center";
    switch (role) {
      case 'admin':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      case 'member':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="p-6">
      <div className="flex items-center mb-6">
        <User className="h-8 w-8 text-[#7030a0] mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-semibold">User Profile</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              className="flex items-center space-x-2"
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                <path d="m15 5 4 4"/>
              </svg>
              <span>Edit Profile</span>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Upload Section */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage 
                    src={avatarUrl || user?.user_metadata?.avatar_url} 
                    alt="Profile picture" 
                  />
                  <AvatarFallback className="text-lg">
                    {organisationMember?.full_name ? 
                      getInitials(organisationMember.full_name) : 
                      <User className="h-8 w-8" />
                    }
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <Label className="text-sm font-medium">Profile Picture</Label>
                <p className="text-sm text-gray-500 mt-1">
                  Upload a new avatar for your profile
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* User Information */}
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center">
                  <User className="h-4 w-4 mr-2 text-blue-500" />
                  Full Name
                </Label>
                <Input
                  value={organisationMember?.full_name || 'N/A'}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-green-500" />
                  Email Address
                </Label>
                <Input
                  value={organisationMember?.email || user?.email || 'N/A'}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-orange-500" />
                  Phone Number
                </Label>
                <Input
                  value={organisationMember?.phone_number || 'N/A'}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center">
                  <Shield className="h-4 w-4 mr-2 text-purple-500" />
                  Role
                </Label>
                <div className="pt-2">
                  <span className={getRoleBadge(organisationMember?.role || 'member')}>
                    {organisationMember?.role || 'member'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EditProfileDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen}
        organisationMember={organisationMember}
      />
    </div>
  );
};
