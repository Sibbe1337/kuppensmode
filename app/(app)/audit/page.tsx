"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { 
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // For potential text based filters
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { DatePicker } from "@/components/ui/datepicker"; // Assuming this exists or will be added
import { Loader2, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Timestamp } from '@google-cloud/firestore'; // For typing serverTimestamp fields

interface AuditLogEntry {
  id: string;
  timestamp: { seconds: number, nanoseconds: number } | string; // Firestore Timestamp or ISO string after JSON stringify/parse
  type: string;
  details: any;
}

interface AuditApiResponse {
  logs: AuditLogEntry[];
  currentPage: number;
  hasNextPage: boolean;
  limit: number;
}

const AUDIT_LOG_TYPES = [
    { value: "snapshot_created", label: "Snapshot Created" },
    { value: "restore_initiated", label: "Restore Initiated" },
    { value: "restore_completed", label: "Restore Completed" },
    { value: "restore_failed", label: "Restore Failed" },
    { value: "billing_subscription_created", label: "Subscription Created" },
    { value: "billing_subscription_updated", label: "Subscription Updated" },
    { value: "billing_subscription_canceled", label: "Subscription Canceled" },
];

const AuditLogPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("");
  // const [startDate, setStartDate] = useState<Date | undefined>();
  // const [endDate, setEndDate] = useState<Date | undefined>();
  const limit = 20;

  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: limit.toString(),
    ...(filterType && { type: filterType }),
    // ...(startDate && { startDate: startDate.toISOString().split('T')[0] }),
    // ...(endDate && { endDate: endDate.toISOString().split('T')[0] }),
  }).toString();

  const { data, error, isLoading } = useSWR<AuditApiResponse>(`/api/audit?${queryParams}`, fetcher);

  const handleExportCsv = () => {
    // Basic CSV export logic (can be expanded)
    if (!data || !data.logs || data.logs.length === 0) return;
    const headers = ["Timestamp", "Type", "Details"];
    const rows = data.logs.map(log => [
      new Date((log.timestamp as {seconds: number}).seconds * 1000).toLocaleString(),
      log.type,
      JSON.stringify(log.details)
    ]);
    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n"
        + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "audit_log.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (timestamp: AuditLogEntry['timestamp']): string => {
    if (typeof timestamp === 'string') return new Date(timestamp).toLocaleString();
    if (timestamp && typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }
    return 'Invalid Date';
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="h-4 w-4 mr-2 opacity-50" />
                    <SelectValue placeholder="Filter by type..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {AUDIT_LOG_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* TODO: Add Date Pickers for startDate and endDate */}
            {/* <DatePicker date={startDate} setDate={setStartDate} placeholder="Start Date" /> */}
            {/* <DatePicker date={endDate} setDate={setEndDate} placeholder="End Date" /> */}
          <Button variant="outline" onClick={handleExportCsv} disabled={!data || !data.logs || data.logs.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="text-center py-10 px-4 border border-dashed border-destructive rounded-lg text-destructive">
          <p className="text-xl font-semibold mb-1">Failed to load audit logs</p>
          <p className="text-sm">{error.message || "Could not fetch audit log data."}</p>
        </div>
      )}

      {data && !isLoading && !error && (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Timestamp</TableHead>
                  <TableHead className="w-[200px]">Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.length > 0 ? (
                  data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell>
                        <span className="font-medium">
                            {AUDIT_LOG_TYPES.find(t => t.value === log.type)?.label || log.type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <pre className="text-xs whitespace-pre-wrap break-all bg-muted p-2 rounded-sm">
                            {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No audit logs found for the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination Controls */}
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {data.currentPage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={!data.hasNextPage || isLoading}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogPage; 