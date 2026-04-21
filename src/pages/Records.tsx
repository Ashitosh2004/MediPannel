import React, { useState, useEffect, useRef } from 'react';
import { 
  Page, 
  PageHeader, 
  PageTitle, 
  PageDescription, 
  PageActions, 
  PageBody, 
  Button, 
  DataTable, 
  Badge, 
  EmptyState,
  StatGroup,
  Stat,
  Persona,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Field,
  FieldLabel,
  FieldError,
  Banner,
  LoadingOverlay
} from '@blinkdotnew/ui';
import { 
  Plus, 
  FileText, 
  Upload, 
  Download, 
  Search, 
  Calendar, 
  Clock, 
  Filter,
  Trash2,
  FileCheck,
  FileX,
  FileWarning,
  Eye,
  MoreVertical,
  X,
  FilePlus,
  ArrowUpCircle
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export function Records() {
  // Typed alias so that any[] columns are accepted without TS2322 under strictNullChecks
  const DT = DataTable as React.ComponentType<{ columns: any[]; data: any[]; className?: string }>;
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [recordType, setRecordType] = useState('Report');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    getDocs(query(
      collection(db, 'records'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )).then(snapshot => {
      setRecords(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {
      setRecords([]);
    }).finally(() => {
      setLoading(false);
    });
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!user || !file) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `records/${user.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const fileUrl = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'records'), {
        userId: user.uid,
        fileName: file.name,
        fileUrl: fileUrl,
        storagePath: snapshot.ref.fullPath,
        type: recordType,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        createdAt: serverTimestamp(),
      });

      toast.success('Record uploaded successfully!');
      setIsModalOpen(false);
      setFile(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload record');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (record: any) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      if (record.storagePath) {
        const fileRef = ref(storage, record.storagePath);
        await deleteObject(fileRef);
      }
      await deleteDoc(doc(db, 'records', record.id));
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
      )
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
      )
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
      }
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
      )
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Medical Records</h1>
          <p className="text-muted-foreground font-medium mt-1">Access and manage your digital health documentation.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2">
          <Upload size={18} />
          <span>Upload Record</span>
        </Button>
      </div>

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
              <div className="text-2xl font-black text-foreground">{records.filter(r => !['Report', 'Prescription'].includes(r.type)).length}</div>
            </div>
         </Card>
      </div>

      <div className="glass-card border-none overflow-hidden">
        <div className="p-8 border-b border-border/40 bg-white/30">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Health Vault</h3>
              <div className="flex items-center gap-4">
                 <div className="relative w-64 hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input placeholder="Search records..." className="pl-10 h-10 rounded-xl bg-white/50 border-border/50" />
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
               <div className="animate-spin h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4"></div>
               <p className="text-muted-foreground font-medium">Loading vault...</p>
            </div>
          ) : records.length > 0 ? (
            <DT columns={columns} data={records} className="border-none" />
          ) : (
            <EmptyState 
              icon={<FilePlus size={48} className="text-muted-foreground/30" />}
              title="Your Health Vault is Empty"
              description="Keep all your medical documents in one secure place."
              action={{ label: 'Upload Your First Document', onClick: () => setIsModalOpen(true) }}
              className="py-20"
            />
          )}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl glass animate-in zoom-in-95">
          <div className="bg-primary/5 p-8 border-b border-primary/10">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-primary flex items-center gap-3">
                <Upload className="w-6 h-6" />
                Upload Document
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium mt-1">
                Securely upload your medical reports, imaging, or prescriptions.
              </DialogDescription>
            </DialogHeader>
          </div>
          
          <div className="p-8 space-y-6">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer group relative overflow-hidden ${
                file ? 'border-primary/50 bg-primary/5' : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {file ? (
                <div className="space-y-3 animate-in fade-in zoom-in-95">
                  <div className="bg-primary text-white w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/20">
                    <FileCheck size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground truncate max-w-[300px] mx-auto">{file.name}</p>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Ready to upload • {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="absolute top-4 right-4 p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-full transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-muted w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
                    <Upload size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-foreground">Click to browse or drag and drop</p>
                    <p className="text-xs font-medium text-muted-foreground">PDF, JPG, PNG or DOC (Max 10MB)</p>
                  </div>
                </div>
              )}
            </div>

            <Field>
              <FieldLabel className="text-foreground/80 font-bold mb-1.5 ml-1">Document Type</FieldLabel>
              <div className="relative">
                <Select onValueChange={setRecordType} value={recordType}>
                  <SelectTrigger className="h-14 bg-white/50 border-border/50 rounded-2xl focus:ring-4 focus:ring-primary/10 transition-all font-medium">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50">
                    <SelectItem value="Report" className="rounded-lg py-3 cursor-pointer font-bold">Lab Report</SelectItem>
                    <SelectItem value="Prescription" className="rounded-lg py-3 cursor-pointer font-bold">Prescription</SelectItem>
                    <SelectItem value="Imaging" className="rounded-lg py-3 cursor-pointer font-bold">Imaging (X-Ray, MRI)</SelectItem>
                    <SelectItem value="Other" className="rounded-lg py-3 cursor-pointer font-bold">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Field>

            <Banner variant="info" className="rounded-2xl border-none bg-blue-500/5 text-blue-600">
              <div className="flex items-start gap-3 p-1">
                 <FileCheck size={18} className="mt-0.5 shrink-0" />
                 <p className="text-[11px] font-medium leading-relaxed">
                   Your documents are encrypted and only accessible by you and your authorized healthcare providers.
                 </p>
              </div>
            </Banner>

            <DialogFooter className="pt-4">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-12 px-6 font-bold hover:bg-black/5">
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={isUploading || !file} 
                className="rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2"
              >
                {isUploading ? (
                   <>
                    <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                    <span>Uploading...</span>
                   </>
                ) : (
                  <>
                    <ArrowUpCircle size={18} />
                    <span>Confirm Upload</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
