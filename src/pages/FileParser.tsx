import React, { useState, useEffect } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { supabase } from '../lib/supabase';
import { Upload, FileType, CheckCircle, AlertCircle, Loader2, Trash2, FolderPen } from 'lucide-react';
import toast from 'react-hot-toast';
import type { StorageFile } from '../types';
import { cn } from '../lib/utils';



export function FileParser() {
  const confirmAction = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [parseType, setParseType] = useState<string>('exam');
  const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  
  const [activeSemesters, setActiveSemesters] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState('tri_semester');
  const [semesterContext, setSemesterContext] = useState<'current' | 'next'>('current');
  const [customFileName, setCustomFileName] = useState('');

  const [uploadedFiles, setUploadedFiles] = useState<{ folder: string, files: StorageFile[] }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    fetchActiveSemesters();
    fetchAllUploadedFiles();
  }, []);

  const fetchAllUploadedFiles = async () => {
    setLoadingFiles(true);
    try {
      const folders = ['facultylist', 'calendar', 'examschedule', 'advisingschedule'];
      const results = [];
      
      for (const folder of folders) {
        const { data, error } = await supabase.storage.from('academic_documents').list(folder, {
          limit: 50,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        
        if (!error && data) {
           // filter out the empty placeholder folders that supabase sometimes returns
           const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder' && f.id);
           if (validFiles.length > 0) {
             results.push({ folder, files: validFiles });
           }
        }
      }
      setUploadedFiles(results);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleDeleteFile = async (folder: string, fileName: string) => {
    if (!await confirmAction(`Are you sure you want to delete ${fileName}?`)) return;
    
    try {
      const { error } = await supabase.storage.from('academic_documents').remove([`${folder}/${fileName}`]);
      if (error) throw error;
      
      // Remove from UI
      setUploadedFiles(prev => prev.map(group => ({
        ...group,
        files: group.files.filter(f => f.name !== fileName)
      })).filter(group => group.files.length > 0));
      
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const fetchActiveSemesters = async () => {
    try {
      const { data } = await supabase.from('active_semester').select('*');
      if (data) setActiveSemesters(data);
    } catch (err) {
      console.error('Failed to fetch active semesters', err);
    }
  };

  const getPrefixForType = (type: string) => {
    switch (type) {
      case 'exam': return 'Exam Schedule';
      case 'course': return 'Faculty List';
      case 'calendar': return 'Academic Calender';
      case 'advising': return 'Faculty Advising';
      default: return 'Document';
    }
  };

  useEffect(() => {
    const active = activeSemesters.find(s => s.track === selectedTrack);
    const code = active ? (semesterContext === 'current' ? active.current_semester_code : active.next_semester_code) : '';
    const semName = code ? code.replace(/([a-zA-Z]+)(\d+)/, '$1 $2') : '';
    const ext = parseType === 'advising' ? '.eml' : '.pdf';
    const prefix = getPrefixForType(parseType);
    
    // Handshake with Azure Function: Bi-semester files MUST contain PHRM, LAW, or LLB.
    // We'll use 'PHRM LLB' as a standard suffix to ensure correct routing for all Bi-track documents.
    const trackSuffix = selectedTrack === 'bi_semester' ? ' PHRM LLB' : '';
    
    if (semName) {
      setCustomFileName(`${prefix} ${semName}${trackSuffix}${ext}`);
    } else {
      setCustomFileName(`${prefix}${trackSuffix}${ext}`);
    }
  }, [parseType, activeSemesters, selectedTrack, semesterContext]);

  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const isEml = droppedFile.name.endsWith('.eml');
      const isPdf = droppedFile.name.endsWith('.pdf');
      if ((parseType === 'advising' && !isEml) || (parseType !== 'advising' && !isPdf)) {
        toast.error(`Invalid file type. Please upload a ${parseType === 'advising' ? '.eml' : '.pdf'} file.`);
        return;
      }
      setFile(droppedFile);
      toast.success(`Selected file: ${droppedFile.name}`);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file to upload.');
      setStatus('error');
      return;
    }
    
    const ext = parseType === 'advising' ? '.eml' : '.pdf';
    if (!customFileName.endsWith(ext)) {
      setMessage(`Filename must end with ${ext}`);
      setStatus('error');
      return;
    }

    try {
      setStatus('parsing');
      setMessage('Uploading file to storage...');

      // Determine the correct folder based on document type
let folderName = 'misc';
        if (parseType === 'exam') folderName = 'examschedule';
        else if (parseType === 'course') folderName = 'facultylist';
        else if (parseType === 'calendar') folderName = 'calendar';
        else if (parseType === 'advising') folderName = 'advisingschedule';

      // Avoid spaces/weird chars exactly or keep filename mostly untouched? 
      // The user requested to edit it, and the Azure parser depends on naming (e.g. Faculty List Spring 2026.pdf).
      const finalName = customFileName.trim();
      const filePath = `${folderName}/${finalName}`;

      // Upload the file to the 'academic_documents' bucket
      const { error: uploadError } = await supabase.storage
        .from('academic_documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setMessage(`File uploaded to ${folderName}/! Triggering parser backend now...`);

      // Automatically trigger the parser directly via azure-admin-proxy
      let actionName = '';
      if (parseType === 'calendar') actionName = 'parse_calendar';
      else if (parseType === 'course') actionName = 'parse_faculty';
      else if (parseType === 'exam') actionName = 'parse_exam';
      else if (parseType === 'advising') actionName = 'parse_advising';

      if (actionName) {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          if (refreshed?.session) session = refreshed.session;
        }

        const { data: parseResult, error: parseError } = await supabase.functions.invoke('azure-admin-proxy', {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          body: {
            action: actionName,
            payload: { file_path: filePath }
          }
        });

        if (parseError) {
          throw new Error(`Upload succeeded, but parser trigger failed: ${parseError.message}`);
        }

        if (parseResult && (parseResult.status === 'ok' || parseResult.status === 'success' || parseResult.count !== undefined)) {
          setStatus('success');
          setMessage(`Parsed successfully! ${parseResult.count ? `${parseResult.count} events/entries saved to ${parseResult.table || 'database'}.` : 'Data processed and saved to database.'}`);
          toast.success('File uploaded and parsed successfully!');
        } else {
          throw new Error(`Parser error: ${parseResult?.error || parseResult?.message || 'Unknown parsing failure'}`);
        }
      } else {
        setStatus('success');
        setMessage(`File uploaded to ${folderName}/ successfully!`);
      }

      fetchAllUploadedFiles();

    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error uploading or parsing file');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
          <Upload className="w-8 h-8 text-primary dark:text-primary" />
          File Parsing System
        </h1>
      </div>

      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
        <div className="p-8">
          <form onSubmit={handleUpload} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                  Academic Track (Tri/Bi)
                </label>
                <select
                  value={selectedTrack}
                  onChange={(e) => setSelectedTrack(e.target.value)}
                  className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring outline-none transition-all font-semibold text-foreground appearance-none cursor-pointer"
                >
                  <option value="tri_semester" className="dark:bg-slate-900">Tri-Semester (Standard)</option>
                  <option value="bi_semester" className="dark:bg-slate-900">Bi-Semester (Pharmacy/Law)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                  Target Semester
                </label>
                <select
                  value={semesterContext}
                  onChange={(e) => setSemesterContext(e.target.value as any)}
                  className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring outline-none transition-all font-semibold text-foreground appearance-none cursor-pointer"
                >
                  <option value="current" className="dark:bg-slate-900">Current Semester</option>
                  <option value="next" className="dark:bg-slate-900">Upcoming / Next Semester</option>
                </select>
                <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight ml-1">
                  Switch to "Upcoming" if you are uploading data for the next term.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                  Document Type
                </label>
                <select
                  value={parseType}
                  onChange={(e) => setParseType(e.target.value)}
                  className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring outline-none transition-all font-semibold text-foreground appearance-none cursor-pointer"
                >
                  <option value="exam" className="dark:bg-slate-900">Exam Schedule</option>
                  <option value="course" className="dark:bg-slate-900">Course Catalog / Advising</option>     
                  <option value="calendar" className="dark:bg-slate-900">Academic Calendar</option>
                  <option value="advising" className="dark:bg-slate-900">Faculty Advising Routine</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">
                  Final Upload Filename
                </label>
                <input
                  type="text"
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring outline-none transition-all font-semibold text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  placeholder={parseType === 'advising' ? "e.g., Faculty Advising Spring 2026.eml" : "e.g., Faculty List Spring 2026.pdf"}
                />
                <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight ml-1">
                  Auto-populated based on context. Ends in {parseType === 'advising' ? '.eml' : '.pdf'}.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 ml-1">  
                Upload Binary File
              </label>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "mt-1 flex justify-center px-8 pt-8 pb-10 border-2 border-dashed rounded-2xl transition-all group cursor-pointer",
                  isDragging 
                    ? "border-primary bg-primary/10 scale-[1.01]" 
                    : "border-border hover:border-primary/50 bg-background/50"
                )}
              >
                <div className="space-y-4 text-center">
                  <div className="w-16 h-16 bg-card rounded-lg shadow-sm border border-border flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <FileType className="h-8 w-8 text-primary" />      
                  </div>
                  <div className="flex text-sm text-muted-foreground justify-center">   
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-semibold text-primary dark:text-primary hover:text-primary transition-colors focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept={parseType === 'advising' ? '.eml' : '.pdf'} onChange={handleFileChange} />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {file ? file.name : `${parseType === 'advising' ? 'EML' : 'PDF'} up to 10MB`}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-4">
              <button
                type="submit"
                disabled={status === 'parsing'}
                className="w-full md:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-sm dark:shadow-none font-semibold text-[10px] uppercase tracking-wider"
              >
                {status === 'parsing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing Matrix...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Execute Data Parse</>        
                )}
              </button>
            </div>
          </form>

          {status !== 'idle' && (
            <div className={`mt-8 p-6 rounded-lg border flex items-start gap-4 animate-in slide-in-from-top-4 ${      
              status === 'error' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' :
              status === 'success' ? 'bg-primary/10 dark:bg-primary/10 text-emerald-800 dark:text-primary border-primary/20 dark:border-primary/20' :
              'bg-primary/10 dark:bg-primary/10 text-indigo-800 dark:text-primary border-primary/20 dark:border-primary/20'
            }`}>
              <div className="mt-1">
                {status === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
                {status === 'success' && <CheckCircle className="w-6 h-6 flex-shrink-0" />}
                {status === 'parsing' && <Loader2 className="w-6 h-6 flex-shrink-0 animate-spin" />}
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-sm uppercase tracking-wider">
                  {status === 'error' ? 'Parsing Failed' :
                   status === 'success' ? 'Parse Successful' :
                   'Parsing Document...'}
                </h3>
                <p className="text-sm font-medium mt-1 leading-relaxed">{message}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
        <div className="px-8 py-6 border-b border-border flex flex-col md:flex-row justify-between items-center gap-4 bg-muted/50">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-3 tracking-tight">
            <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-xl">
              <FolderPen className="w-5 h-5 text-primary" />
            </div>
            Academic Repository
          </h2>
          <button
            onClick={fetchAllUploadedFiles}
            className="flex items-center gap-2 px-4 py-2 bg-card border border-slate-200 dark:border-border rounded-xl hover:bg-accent hover:text-accent-foreground text-[10px] font-semibold text-muted-foreground uppercase tracking-wider transition-all shadow-sm"
          >
            <Loader2 className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
            Refresh Index
          </button>
        </div>
        
        <div className="p-0">
          {loadingFiles && uploadedFiles.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scanning bucket objects...</p>
            </div>
          ) : uploadedFiles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground font-bold text-sm">
               The academic repository is currently empty.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {uploadedFiles.map((group) => (
                <div key={group.folder} className="p-8">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-6 flex items-center gap-3">
                    <span className="text-primary dark:text-primary">/</span> {group.folder}
                    <span className="bg-muted text-muted-foreground py-1 px-3 rounded-full text-[10px] font-semibold border border-slate-200 dark:border-border shadow-sm">{group.files.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {group.files.map(f => (
                      <div key={f.id} className="flex items-center justify-between p-5 rounded-lg bg-card border border-slate-100 dark:border-border hover:border-primary/20 dark:hover:border-indigo-500 transition-all group shadow-sm">
                        <div className="flex items-start gap-4 truncate pr-4">
                          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-primary/10 dark:group-hover:bg-primary/10 transition-colors">
                            <FileType className="w-5 h-5 text-primary group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:tracking-tight transition-all" title={f.name}>{f.name}</p>
                            <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                              {f.metadata ? `${(f.metadata.size / 1024).toFixed(1)} KB` : 'Unknown size'} • 
                              {new Date(f.created_at || Date.now()).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteFile(group.folder, f.name)}
                          className="opacity-0 group-hover:opacity-100 p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all flex-shrink-0"
                          title="Purge Object"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
