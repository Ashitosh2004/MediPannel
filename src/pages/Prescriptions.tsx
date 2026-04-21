import React, { useState, useEffect } from 'react';
import { 
  Button, 
  DataTable, 
  Badge, 
  EmptyState,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Persona,
  Input
} from '@blinkdotnew/ui';
import { 
  Plus, 
  Pill, 
  Download, 
  Search, 
  Stethoscope,
  FileText,
  AlertCircle,
  ExternalLink,
  PlusCircle,
  Link as LinkIcon
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format, isValid } from 'date-fns';
import { toast } from 'react-hot-toast';

export function Prescriptions() {
  // Typed alias so that any[] columns are accepted without TS2322 under strictNullChecks
  const DT = DataTable as React.ComponentType<{ columns: any[]; data: any[]; className?: string }>;
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;

    getDocs(query(
      collection(db, 'prescriptions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )).then(snapshot => {
      setPrescriptions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {
      setPrescriptions([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [user]);

  const filtered = prescriptions.filter(p =>
    !search ||
    p.medication?.toLowerCase().includes(search.toLowerCase()) ||
    p.doctorName?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCnt = prescriptions.filter(p => p.status === 'active').length;
  const completedCnt = prescriptions.filter(p => p.status === 'completed').length;
  const expiredCnt = prescriptions.filter(p => p.status === 'expired').length;

  const safeFormatDate = (val: any) => {
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : '—';
    } catch {
      return '—';
    }
  };

  const columns: any[] = [
    { 
      accessorKey: 'medication', 
      header: 'Medication',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
            <Pill size={16} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground truncate">{row.original.medication || '—'}</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {row.original.dosage || ''}{row.original.dosage && row.original.frequency ? ' • ' : ''}{row.original.frequency || ''}
            </div>
          </div>
        </div>
      )
    },
    { 
      accessorKey: 'doctorName', 
      header: 'Prescribed By',
      cell: ({ row }: any) => (
        <Persona 
          name={row.original.doctorName || 'Unknown Doctor'} 
          subtitle={row.original.specialty || ''} 
        />
      )
    },
    { 
      accessorKey: 'startDate', 
      header: 'Date',
      cell: ({ row }: any) => (
        <div className="text-sm font-semibold text-muted-foreground">
          {safeFormatDate(row.original.startDate || row.original.createdAt)}
        </div>
      )
    },
    { 
      accessorKey: 'status', 
      header: 'Status',
      cell: ({ row }: any) => {
        const status = row.original.status;
        const colorMap: Record<string, string> = {
          active: 'bg-primary/10 text-primary',
          completed: 'bg-green-500/10 text-green-600',
          expired: 'bg-destructive/10 text-destructive',
        };
        return (
          <Badge 
            className={`rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider border-transparent ${colorMap[status] || 'bg-muted text-muted-foreground'}`}
          >
            {status || 'Unknown'}
          </Badge>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex justify-end">
          {row.original.fileUrl && (
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl border-border hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all font-bold gap-2 h-9 text-xs"
              onClick={() => window.open(row.original.fileUrl, '_blank')}
            >
              <Download size={14} />
              <span>PDF</span>
            </Button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Prescriptions</h1>
          <p className="text-muted-foreground font-medium mt-1">Track your active medications and past history.</p>
        </div>
        <Button className="rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2">
          <Plus size={16} />
          <span>Refill Request</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <Pill size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active</span>
            </div>
            <div className="text-2xl font-black text-foreground">{activeCnt}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">Active prescriptions</div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-green-500/10 rounded-xl text-green-600">
                <FileText size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Done</span>
            </div>
            <div className="text-2xl font-black text-foreground">{completedCnt}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">Completed courses</div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2.5 bg-destructive/10 rounded-xl text-destructive">
                <AlertCircle size={18} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expired</span>
            </div>
            <div className="text-2xl font-black text-foreground">{expiredCnt}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">Expired prescriptions</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg font-bold text-foreground">Prescription Records</CardTitle>
            <div className="relative w-64 hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <Input
                placeholder="Search medications..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl bg-background border-border text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <div>
          {loading ? (
            <div className="p-16 text-center">
              <div className="animate-spin h-9 w-9 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground font-medium text-sm">Loading prescriptions...</p>
            </div>
          ) : filtered.length > 0 ? (
            <DT columns={columns} data={filtered} className="border-none" />
          ) : (
            <EmptyState 
              icon={<Pill size={40} className="text-muted-foreground/30" />}
              title="No Prescriptions Found"
              description={search ? `No results for "${search}"` : 'You have no recorded prescriptions at this time.'}
              className="py-16"
            />
          )}
        </div>
      </Card>

      {/* Bottom CTA cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border border-border bg-primary/5 shadow-sm overflow-hidden">
          <CardContent className="p-7">
            <div className="flex gap-5 items-start">
              <div className="bg-primary rounded-2xl p-3.5 text-primary-foreground shadow-md shrink-0">
                <Stethoscope size={26} />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-lg font-bold text-foreground">Need a refill?</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Request a refill for recurring medications. Your doctor will review and approve within 24 hours.
                </p>
                <Button className="mt-2 rounded-xl h-10 font-bold flex items-center gap-2 text-sm shadow-md shadow-primary/20">
                  <span>Start Request</span>
                  <PlusCircle size={15} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm overflow-hidden">
          <CardContent className="p-7">
            <div className="flex gap-5 items-start">
              <div className="bg-indigo-500 rounded-2xl p-3.5 text-white shadow-md shrink-0">
                <FileText size={26} />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="text-lg font-bold text-foreground">Medication Guide</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Learn about your medications, side effects, and best practices in our help center.
                </p>
                <Button variant="outline" className="mt-2 rounded-xl h-10 font-bold border-border hover:border-primary/40 hover:bg-primary/5 flex items-center gap-2 text-sm">
                  <span>Read Guide</span>
                  <ExternalLink size={15} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
