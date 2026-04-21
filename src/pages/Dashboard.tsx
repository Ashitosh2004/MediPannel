import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Button,
  Badge,
  EmptyState,
  AreaChart,
  Persona
} from '@blinkdotnew/ui';
import { 
  Calendar, 
  Clock, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  Stethoscope,
  Activity,
  Heart,
  Pill,
  TrendingUp
} from 'lucide-react';
import { useNavigate, Link } from '@tanstack/react-router';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, isValid } from 'date-fns';

export function Dashboard() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const apptSnap = await getDocs(query(
          collection(db, 'appointments'),
          where('userId', '==', user.uid),
          where('status', '==', 'upcoming'),
          limit(10)
        ));
        const sorted = apptSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (a.date > b.date ? 1 : -1))
          .slice(0, 3);
        setAppointments(sorted);
      } catch {
        setAppointments([]);
      }

      try {
        const recordsSnap = await getDocs(query(
          collection(db, 'records'),
          where('userId', '==', user.uid),
          limit(10)
        ));
        const sortedRecords = recordsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
          })
          .slice(0, 3);
        setRecords(sortedRecords);
      } catch {
        setRecords([]);
      }

      try {
        const rxSnap = await getDocs(query(
          collection(db, 'prescriptions'),
          where('userId', '==', user.uid),
          where('status', '==', 'active'),
          limit(10)
        ));
        setPrescriptions(rxSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setPrescriptions([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const safeFormatDate = (val: any) => {
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      return isValid(d) ? format(d, 'MMM dd, yyyy') : '—';
    } catch {
      return '—';
    }
  };

  const statsData = [
    { label: 'Upcoming Visits', value: appointments.length, icon: <Calendar size={18} className="text-primary" />, iconBg: 'bg-primary/10' },
    { label: 'Active Prescriptions', value: prescriptions.length, icon: <Pill size={18} className="text-blue-600" />, iconBg: 'bg-blue-500/10' },
    { label: 'Health Records', value: records.length, icon: <FileText size={18} className="text-indigo-600" />, iconBg: 'bg-indigo-500/10' },
  ];

  const chartData = [
    { month: 'Jan', Appointments: 1, Prescriptions: 2 },
    { month: 'Feb', Appointments: 2, Prescriptions: 2 },
    { month: 'Mar', Appointments: 1, Prescriptions: 3 },
    { month: 'Apr', Appointments: 3, Prescriptions: 1 },
    { month: 'May', Appointments: 2, Prescriptions: 2 },
    { month: 'Jun', Appointments: appointments.length, Prescriptions: prescriptions.length },
  ];

  return (
    <div className="space-y-7 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Hello, {userData?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Here's your health overview for today.</p>
        </div>
        <Button 
          onClick={() => navigate({ to: '/appointments' })} 
          className="rounded-xl h-11 px-6 font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2"
        >
          <Calendar size={16} />
          <span>Book Appointment</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {statsData.map((stat) => (
          <Card key={stat.label} className="border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 ${stat.iconBg} rounded-xl`}>
                  {stat.icon}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-foreground">{stat.value}</div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Next Visit */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Activity size={18} />
              </div>
              <CardTitle className="text-base font-bold text-card-foreground">Activity Overview</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <AreaChart 
              data={chartData} 
              dataKey={['Appointments', 'Prescriptions']} 
              xAxisKey="month" 
              height={260}
            />
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Clock size={18} />
              </div>
              <CardTitle className="text-base font-bold text-card-foreground">Next Visit</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin h-7 w-7 border-2 border-primary/20 border-t-primary rounded-full"></div>
              </div>
            ) : appointments.length > 0 ? (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                {appointments.slice(0, 1).map((apt) => (
                  <div key={apt.id} className="space-y-4">
                    <div className="p-4 bg-muted/40 rounded-xl border border-border">
                      <Persona name={apt.doctorName || '—'} subtitle={apt.specialty || ''} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-primary/5 rounded-xl p-3.5 space-y-0.5 border border-primary/10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Date</span>
                        <div className="text-xs font-bold text-primary">{safeFormatDate(apt.date)}</div>
                      </div>
                      <div className="bg-blue-500/5 rounded-xl p-3.5 space-y-0.5 border border-blue-500/10">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-500/70">Time</span>
                        <div className="text-xs font-bold text-blue-600">{apt.time || '—'}</div>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-transparent rounded-full px-3 py-1 font-bold text-[10px] flex items-center w-fit gap-1.5 hover:bg-green-500/20">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      Confirmed
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" asChild className="w-full h-10 rounded-xl font-bold border-border hover:border-primary/40 hover:bg-primary/5 text-sm mt-2">
                  <Link to="/appointments">Manage Appointments</Link>
                </Button>
              </div>
            ) : (
              <EmptyState 
                icon={<Calendar className="text-muted-foreground/30" size={36} />}
                title="No Upcoming Visits"
                description="Book your next check-up."
                action={{ label: 'Book Now', onClick: () => navigate({ to: '/appointments' }) }}
                className="py-8 flex-1"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Records + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Records — real data */}
        <Card className="border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <FileText size={16} />
              </div>
              <CardTitle className="text-base font-bold text-card-foreground">Recent Records</CardTitle>
            </div>
            <Link to="/records" className="text-xs font-bold text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent className="p-5">
            {records.length > 0 ? (
              <div className="space-y-3">
                {records.map(r => (
                  <div 
                    key={r.id}
                    className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border hover:bg-muted/60 transition-all cursor-pointer group"
                    onClick={() => r.fileUrl && window.open(r.fileUrl, '_blank')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-600 shrink-0">
                        <FileText size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{r.fileName || 'Unnamed file'}</div>
                        <div className="text-[10px] font-semibold text-muted-foreground">
                          {safeFormatDate(r.createdAt)} • {r.type || 'Document'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<FileText size={30} className="text-muted-foreground/30" />}
                title="No Records Yet"
                description="Upload your first medical document."
                action={{ label: 'Upload', onClick: () => navigate({ to: '/records' }) }}
                className="py-8"
              />
            )}
          </CardContent>
        </Card>

        {/* Health Reminders */}
        <Card className="border border-border bg-card shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Heart size={16} />
              </div>
              <CardTitle className="text-base font-bold text-card-foreground">Health Reminders</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            {prescriptions.length === 0 && appointments.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={30} className="text-green-500/50" />}
                title="All Clear"
                description="No pending reminders. Your health is on track!"
                className="py-8"
              />
            ) : (
              <>
                {appointments.length > 0 && (
                  <div className="flex gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <div className="bg-primary p-2 rounded-lg text-primary-foreground h-fit shrink-0">
                      <Calendar size={14} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">Upcoming Appointment</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You have {appointments.length} upcoming visit{appointments.length > 1 ? 's' : ''} scheduled.
                      </p>
                    </div>
                  </div>
                )}
                {prescriptions.length > 0 && (
                  <div className="flex gap-3 p-4 bg-amber-500/5 rounded-xl border border-amber-500/10">
                    <div className="bg-amber-500 p-2 rounded-lg text-white h-fit shrink-0">
                      <Pill size={14} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">Active Medications</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You have {prescriptions.length} active prescription{prescriptions.length > 1 ? 's' : ''}. Remember to take them regularly.
                      </p>
                    </div>
                  </div>
                )}
                {appointments.length === 0 && (
                  <div className="flex gap-3 p-4 bg-muted/40 rounded-xl border border-border">
                    <div className="bg-muted-foreground/20 p-2 rounded-lg text-muted-foreground h-fit shrink-0">
                      <AlertCircle size={14} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-foreground">No Upcoming Appointments</div>
                      <p className="text-xs text-muted-foreground mt-0.5">Consider scheduling a routine check-up with your doctor.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
