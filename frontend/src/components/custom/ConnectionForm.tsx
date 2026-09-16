'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input  } from '@/src/components/ui/input';
import { Label  } from '@/src/components/ui/label';
import { Button } from '@/src/components/ui/button';
import { Database, Shield, Globe, Hash, Key } from 'lucide-react';

export default function ConnectionForm() {
  const [formData, setFormData] = React.useState({
    name: 'Local MongoDB', hostname: 'localhost', port: '27017',
    username: '', password: '', authSource: 'admin',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Connection Details
        </CardTitle>
        <CardDescription>
          The connection URI is configured via the <code>MONGODB_URI</code> environment variable on the server. The form below is for reference only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Connection Name</Label>
          <div className="relative">
            <Input id="name" name="name" value={formData.name} onChange={handleChange}
              className="pl-9" />
            <Database className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3 space-y-2">
            <Label htmlFor="hostname">Hostname</Label>
            <div className="relative">
              <Input id="hostname" name="hostname" value={formData.hostname} onChange={handleChange}
                className="pl-9" />
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <div className="relative">
              <Input id="port" name="port" value={formData.port} onChange={handleChange}
                className="pl-9" />
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username (Optional)</Label>
            <div className="relative">
              <Input id="username" name="username" value={formData.username} onChange={handleChange}
                className="pl-9" />
              <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password (Optional)</Label>
            <div className="relative">
              <Input id="password" name="password" type="password" value={formData.password} onChange={handleChange}
                className="pl-9" />
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t p-6 bg-muted/50">
        <p className="text-xs text-muted-foreground">
          To change the MongoDB connection, update the <code>MONGODB_URI</code> variable in your <code>.env</code> file and restart the server.
        </p>
      </CardFooter>
    </Card>
  );
}
