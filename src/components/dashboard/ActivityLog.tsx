"use client";

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, Link as LinkIcon, Bot } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Dummy data types - replace with actual types from @/types
interface SnapshotEntry {
  id: string;
  name: string;
  date: string; // Should be ISO string or Date object
  sizeKb: number;
}

interface ChangeEntry {
  id: string;
  description: string;
  date: string; // Should be ISO string or Date object
  snapshotId: string;
}

interface ActivityLogProps {
  snapshots: SnapshotEntry[];
  changes: ChangeEntry[];
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const formatSize = (kb: number) => {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const ActivityLog: React.FC<ActivityLogProps> = ({ 
  snapshots = [], 
  changes = [] 
}) => {
  const displaySnapshots = snapshots.slice(0, 8);
  const displayChanges = changes.slice(0, 8);

  return (
    <Card className="w-full shadow-lg bg-card border-border/30">
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent className="relative pb-16"> {/* Padding for floating button */}
        <Tabs defaultValue="snapshots" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="snapshots">Recent Snapshots</TabsTrigger>
            <TabsTrigger value="changes">Recent Changes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="snapshots">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-center w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displaySnapshots.length > 0 ? displaySnapshots.map((snap, index) => (
                  <TableRow key={snap.id} className="even:bg-muted/30 dark:even:bg-slate-800/50">
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{snap.name}</TableCell>
                    <TableCell>{formatDate(snap.date)}</TableCell>
                    <TableCell className="text-right">{formatSize(snap.sizeKb)}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No recent snapshots.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {snapshots.length > 8 && (
              <div className="mt-4 text-center">
                <Button variant="link" asChild><Link href="/snapshots">View All Snapshots</Link></Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="changes">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center w-[120px]">Snapshot Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayChanges.length > 0 ? displayChanges.map((change, index) => {
                  const isDummySnapshotId = change.snapshotId === 'snap123' || change.snapshotId === 'snap122';
                  return (
                    <TableRow key={change.id} className="even:bg-muted/30 dark:even:bg-slate-800/50">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>{change.description}</TableCell>
                      <TableCell>{formatDate(change.date)}</TableCell>
                      <TableCell className="text-center">
                        {isDummySnapshotId ? (
                          <LinkIcon className="h-4 w-4 text-muted-foreground mx-auto" />
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={`/snapshots/${change.snapshotId}`}><LinkIcon className="h-4 w-4" /></Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">No recent changes found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            {changes.length > 8 && (
              <div className="mt-4 text-center">
                <Button variant="link" asChild><Link href="/changes">View All Changes</Link></Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Sticky floating AI Assistant button */}
        <div className="absolute bottom-4 right-4">
            <Button variant="outline" size="default" className="rounded-full shadow-lg bg-background hover:bg-muted">
                <Bot className="h-5 w-5 mr-2 text-primary"/>
                AI Assistant
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLog; 