import React, { useRef, useState } from 'react';
import {
  collection, addDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Upload, X, FileText, CheckCircle2, ChevronDown, Lock, Shield,
} from 'lucide-react';
import { CATEGORY_META, type MedCategory } from './types';

interface Props { onClose: () => void; }

const CATEGORIES = Object.entries(CATEGORY_META) as [MedCategory, typeof CATEGORY_META[MedCategory]][];

export function UploadReportModal({ onClose }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<MedCategory>('general');
  const [isRestricted, setIsRestricted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error('File must be under 20 MB'); return; }
    setFile(f);
  }

  async function handleUpload() {
    if (!file || !user) return;
    setUploading(true);
    try {
      const fileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const path = `medlocker/${user.uid}/${fileId}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file, {
        contentType: file.type,
        customMetadata: { ownerId: user.uid },
      });

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve(),
        );
      });

      const url = await getDownloadURL(task.snapshot.ref);

      await addDoc(collection(db, 'medlocker'), {
        userId: user.uid,
        fileUrl: url,
        fileName: file.name,
        fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        storagePath: path,
        category,
        isRestricted,
        createdAt: serverTimestamp(),
        isDeleted: false,
        accessControl: {},
      });

      toast.success('Report uploaded successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload size={17} className="text-primary" />
            </div>
            <div>
              <p className="font-black text-foreground text-sm">Upload Medical Report</p>
              <p className="text-xs text-muted-foreground">Stored in your secure MedLocker</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all group ${
              file
                ? 'border-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/40 hover:bg-muted/40'
            } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.heic"
              onChange={pickFile}
              disabled={uploading}
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <CheckCircle2 size={20} className="text-primary shrink-0" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-bold text-foreground truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!uploading && (
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); setProgress(0); }}
                    className="ml-auto text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center mx-auto mb-3 transition-colors">
                  <FileText size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-semibold text-foreground">Click to select file</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, DOC — max 20 MB</p>
              </>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{progress}% uploaded</p>
            </div>
          )}

          {/* Category */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
              Category
            </p>
            <div className="relative">
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MedCategory)}
                disabled={uploading}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-background text-foreground appearance-none pr-8 focus:outline-none focus:border-primary/50 disabled:opacity-60"
              >
                {CATEGORIES.map(([key, meta]) => (
                  <option key={key} value={key}>{meta.emoji} {meta.label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Sensitivity */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1.5">
              Sensitivity
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([false, true] as const).map(val => (
                <button
                  key={String(val)}
                  onClick={() => setIsRestricted(val)}
                  disabled={uploading}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition-all ${
                    isRestricted === val
                      ? val
                        ? 'bg-destructive/10 text-destructive border-destructive/25'
                        : 'bg-primary/10 text-primary border-primary/25'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  } disabled:opacity-60`}
                >
                  {val ? <Lock size={14} /> : <Shield size={14} />}
                  {val ? 'Restricted' : 'Normal'}
                </button>
              ))}
            </div>
            {isRestricted && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5">
                ⚠️ Patient must verify identity before viewing this file.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Uploading…</>
              ) : (
                <><Upload size={14} />Upload Report</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
