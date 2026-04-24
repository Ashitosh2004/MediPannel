import React, { useState, useEffect } from 'react';
import {
  Button,
  DataTable,
  Badge,
  EmptyState,
  Card,
  CardContent,
} from '@blinkdotnew/ui';
import {
  FileText,
  Search,
  Trash2,
  FileCheck,
  FileWarning,
  Eye,
  FilePlus,
  Filter,
  Lock,
} from 'lucide-react';
import {
  collection, query, where, orderBy, getDocs, deleteDoc, doc,
} from 'firebase/firestore';
import { deleteObject, ref as storageRef } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Link } from '@tanstack/react-router';

// ═══════════════════════════════════════════════════════════════════════════

export function Records() {
  const DT = DataTable as React.ComponentType<{ columns: any[]; data: any[]; className?: string }>;
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getDocs(query(
      collection(db, 'records'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    )).then(snapshot => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {
      setRecords([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [user]);

  const handleDelete = async (record: any) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      if (record.storagePath) {
        await deleteObject(storageRef(storage, record.storagePath));
      }
      await deleteDoc(doc(db, 'records', record.id));
      setRecords(prev => prev.filter(r => r.id !== record.id));
      toast.success('Record deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete record');
    }
  };

  const columns: any[] = [
    {
      accessorKey: 'fileName',
      header: 'File Name',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
            <FileText size={18} />
          </div>
          <div>
            <div className="font-bold text-foreground">{row.original.fileName}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/70">{row.original.size}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }: any) => (
        <Badge
          variant="outline"
          className="rounded-full bg-accent/50 text-accent-foreground border-none px-3 py-1 font-bold text-[10px] uppercase tracking-wider"
        >
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Upload Date',
      cell: ({ row }: any) => {
        const date = row.original.createdAt?.toDate ? row.original.createdAt.toDate() : new Date();
        return (
          <div className="text-sm font-semibold text-muted-foreground">
            {format(date, 'MMM dd, yyyy')}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/50 hover:bg-primary/5 hover:text-primary transition-all font-bold gap-2 h-10 px-4"
            onClick={() => window.open(row.original.fileUrl, '_blank')}
          >
            <Eye size={16} />
            <span>View</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-10 w-10 p-0"
            onClick={() => handleDelete(row.original)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Medical Records</h1>
        <p className="text-muted-foreground font-medium mt-1">Access and manage your digital health documentation.</p>
      </div>

      {/* MedLocker shortcut card */}
      <Link
        to="/medlocker"
        className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-2xl hover:bg-primary/10 hover:border-primary/30 transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Lock size={18} className="text-primary" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">🔒 MedLocker — Secure Medical Vault</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              View &amp; manage reports uploaded by your doctors. Control who has access. (DPDP Act 2023)
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-primary group-hover:underline underline-offset-2 shrink-0 ml-4">
          Open MedLocker →
        </span>
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="glass-card border-none bg-primary shadow-lg shadow-primary/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white">
                <FilePlus size={20} />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Total Documents</span>
              <div className="text-2xl font-black text-white">{records.length}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-500 ring-1 ring-indigo-500/10">
              <FileCheck size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Lab Reports</span>
            <div className="text-2xl font-black text-foreground">{records.filter(r => r.type === 'Report').length}</div>
          </div>
        </Card>

        <Card className="glass-card border-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 ring-1 ring-blue-500/10">
              <FileText size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Prescriptions</span>
            <div className="text-2xl font-black text-foreground">{records.filter(r => r.type === 'Prescription').length}</div>
          </div>
        </Card>

        <Card className="glass-card border-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 ring-1 ring-amber-500/10">
              <FileWarning size={20} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground text-[10px] font-black uppercase tracking-widest">Others</span>
            <div className="text-2xl font-black text-foreground">
              {records.filter(r => !['Report', 'Prescription'].includes(r.type)).length}
            </div>
          </div>
        </Card>
      </div>

      {/* Health Vault table */}
      <div className="glass-card border-none overflow-hidden">
        <div className="p-8 border-b border-border/40 bg-white/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Health Vault</h3>
            <div className="flex items-center gap-4">
              <div className="relative w-64 hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  placeholder="Search records..."
                  className="pl-10 pr-4 h-10 w-full rounded-xl bg-white/50 border border-border/50 text-sm focus:outline-none focus:border-primary/40 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button variant="outline" size="icon" className="rounded-xl border-border/50 h-10 w-10">
                <Filter size={18} className="text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-20 text-center">
              <div className="animate-spin h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Loading vault...</p>
            </div>
          ) : records.length > 0 ? (
            <DT columns={columns} data={records} className="border-none" />
          ) : (
            <EmptyState
              icon={<FilePlus size={48} className="text-muted-foreground/30" />}
              title="Your Health Vault is Empty"
              description="Keep all your medical documents in one secure place."
              className="py-20"
            />
          )}
        </div>
      </div>

    </div>
  );
}
