import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Lock, Settings, CreditCard, Bell, Shield } from "lucide-react";

function TabsDemo() {
  return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[400px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Project Settings</h2>
          <p className="text-sm text-muted-foreground">Manage your account and preferences.</p>
        </div>
        
        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="password" className="gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4 mt-6">
            <div className="p-6 bg-white rounded-xl border shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium">Profile Information</p>
                  <p className="text-xs text-muted-foreground">Update your personal details.</p>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="h-8 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-8 w-2/3 bg-slate-50 rounded animate-pulse" />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="password" className="space-y-4 mt-6">
            <div className="p-6 bg-white rounded-xl border shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <Shield size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium">Security Settings</p>
                  <p className="text-xs text-muted-foreground">Manage your credentials and MFA.</p>
                </div>
              </div>
              <div className="h-20 w-full bg-slate-50 rounded-lg border border-dashed flex items-center justify-center">
                <p className="text-xs text-slate-400">Security dashboard loading...</p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-4 mt-6">
            <div className="p-6 bg-white rounded-xl border shadow-sm space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Bell size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium">Notifications</p>
                  <p className="text-xs text-muted-foreground">Configure your alert preferences.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-12 bg-slate-200 rounded-full" />
                <div className="h-6 w-24 bg-slate-100 rounded" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export { TabsDemo };

