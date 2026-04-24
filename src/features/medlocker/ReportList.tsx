import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import {
  FileText, Lock, Eye, Trash2, UserCheck, ChevronDown, ChevronUp, ShieldAlert,
} from 'lucide-react';
import { format } from 'date-fns';
import { WarningModal } from './WarningModal';
import { PasswordPromptModal } from './PasswordPromptModal';
import { AccessToggle } from './AccessToggle';
import { CATEGORY_META, type MedReport, type LinkedDoctor } from './types';

interface Props {
  reports: MedReport[];
  doctors: LinkedDoctor[];
  section: 'normal' | 'restricted';
}

function ReportCard({ report, doctors }: { report: MedReport; doctors: LinkedDoctor[] }) {
  const [showWarning, setShowWarning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cat = CATEGORY_META[report.category] ?? CATEGORY_META.general;
  const accessCount = Object.values(report.accessControl ?? {}).filter(Boolean).length;

  function openFile() {
    if (report.isRestricted) {
      setShowWarning(true);
    } else {
      window.open(report.fileUrl, '_blank');
    }
  }

  function onWarnConfirm() {
    setShowWarning(false);
    setShowPassword(true);
  }

  function onVerified() {
    window.open(report.fileUrl, '_blank');
  }

  async function softDelete() {
    if (!confirm(`Delete "${report.fileName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await updateDoc(doc(db, 'medlocker', report.id), { isDeleted: true });
      toast.success('Report deleted');
    } catch {
      toast.error('Delete failed');
      setDeleting(false);
    }
  }

  return (
    <>
      {showWarning && (
        <WarningModal onClose={() => setShowWarning(false)} onConfirm={onWarnConfirm} />
      )}
      {showPassword && (
        <PasswordPromptModal onClose={() => setShowPassword(false)} onVerified={onVerified} />
      )}

      <div className={`bg-card border rounded-2xl transition-all hover:shadow-md ${
        report.isRestricted ? 'border-destructive/20' : 'border-border'
      }`}>
        {/* Main row */}
        <div className="flex items-start gap-3 p-4">
          {/* Icon */}
          <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
            report.isRestricted ? 'bg-destructive/10' : 'bg-primary/10'
          }`}>
            {report.isRestricted
              ? <Lock size={18} className="text-destructive" />
              : <FileText size={18} className="text-primary" />
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground text-sm truncate max-w-[200px]">
                {report.fileName}
              </p>
              {report.isRestricted && (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/10 text-destructive shrink-0">
                  <ShieldAlert size={9} />Sensitive
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${cat.color}`}>
                {cat.emoji} {cat.label}
              </span>
              {report.fileSize && (
                <span className="text-xs text-muted-foreground">{report.fileSize}</span>
              )}
              {report.createdAt?.toDate && (
                <span className="text-xs text-muted-foreground">
                  {format(report.createdAt.toDate(), 'MMM dd, yyyy')}
                </span>
              )}
            </div>

            {report.uploadedByDoctor && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Uploaded by Dr. {report.uploadedByDoctor}
              </p>
            )}

            <button
              onClick={() => setShowAccess(v => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-1.5 transition-colors"
            >
              <UserCheck size={11} />
              {accessCount} doctor{accessCount !== 1 ? 's' : ''} with access
              {showAccess ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={openFile}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              title="View file"
            >
              <Eye size={15} />
            </button>
            <button
              onClick={softDelete}
              disabled={deleting}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Expandable access panel */}
        {showAccess && (
          <div className="border-t border-border px-4 pb-4 pt-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
              Doctor Access Control
            </p>
            <AccessToggle report={report} doctors={doctors} />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * ReportList
 * Renders a section of reports (normal or restricted) with empty state.
 */
export function ReportList({ reports, doctors, section }: Props) {
  if (reports.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-10 text-center">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
          {section === 'restricted'
            ? <Lock size={22} className="text-muted-foreground" />
            : <FileText size={22} className="text-muted-foreground" />
          }
        </div>
        <p className="font-bold text-foreground text-sm">
          No {section === 'restricted' ? 'restricted' : 'normal'} reports yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {section === 'restricted'
            ? 'Sensitive reports will appear here.'
            : 'Your general health reports will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <ReportCard key={r.id} report={r} doctors={doctors} />
      ))}
    </div>
  );
}
