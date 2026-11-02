import React, { useState, useEffect } from 'react';
import { 
  Globe, ShieldCheck, Calendar, Play, 
  Loader2, CloudUpload, FileText,
  Table as TableIcon, User, Lock, Zap,
  Terminal, History, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LogEntry {
  msg: string;
  time: string;
  type: 'info' | 'success' | 'error';
}

interface Course {
  course_code: string;
  section_number: string;
  course_name: string;
  faculty_initials: string;
  faculty_full_name?: string;
  faculty_designation?: string;
  capacity: string;
  dedicated_department: string;
  credit_val?: string;
  schedule_data: Array<{
    day: string;
    startTime: string;
    endTime: string;
    room: string;
    type?: string;
  }>;
}

interface SyncLog {
  id: string;
  semester: string;
  total_courses: number;
  created_at: string;
  status: string;
  report?: string[];
  added?: number;
  updated?: number;
}

export function PortalAutomation() {
  const [id, setId] = useState('Loading...');
  const [semester, setSemester] = useState('');
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [scrapedData, setScrapedData] = useState<Course[]>([]);
  const [isPushing, setIsPushing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [isAzureLive, setIsAzureLive] = useState<'checking' | 'live' | 'down'>('checking');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function init() {
      // 1. Fetch Config
      const { data: config } = await supabase.from('scraper_config').select('*').single();
      if (config) {
        setId(config.student_id);
      }

      // 2. Fetch Semesters
      const { data: sems } = await supabase.from('semesters').select('title').order('created_at', { ascending: false });
      if (sems) {
        setAvailableSemesters(sems.map(s => s.title));
        if (sems.length > 0) setSemester(sems[0].title);
      }

      // 3. Fetch Sync History
      const { data: hist } = await supabase.from('scraper_logs').select('*').order('created_at', { ascending: false }).limit(5);
      if (hist) setSyncHistory(hist);

      // 4. Check Azure Health
      checkAzureHealth();
    }
    init();
  }, []);

  const checkAzureHealth = async () => {
    setIsAzureLive('checking');
    try {
      const res = await supabase.functions.invoke('azure-admin-proxy', {
        body: {
          action: 'portal_sync',
          semester: 'PING',
          preview: true
        }
      });
      if (!res.error) setIsAzureLive('live');
      else setIsAzureLive('down');
    } catch {
      setIsAzureLive('down');
    }
  };

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [{ msg, time: new Date().toLocaleTimeString(), type }, ...prev].slice(0, 50));
  };

  const handleStartScrape = async () => {
    setScrapedData([]);
    setStatus('running');
    addLog(`Initiating extraction for ${semester}...`, 'info');
    
    try {
      const { data: result, error: scrapeError } = await supabase.functions.invoke('azure-admin-proxy', {
        body: {
          action: 'portal_sync',
          semester: semester,
          preview: true
        }
      });

      if (scrapeError) throw scrapeError;
      
      if (result.status === 'success' && result.data) { 
        setScrapedData(result.data); 
        setStatus('success'); 
        addLog(`Successfully extracted ${result.data.length} records.`, 'success');
      } else {
        const errorMsg = result.report?.join('\n') || result.error || "Unknown Error";
        addLog(`Extraction failed: ${errorMsg}`, 'error');
        setStatus('error');
      }
    } catch (err: unknown) { 
      const error = err as Error;
      addLog(`Network error: ${error.message}`, 'error');
      setStatus('error'); 
    }
  };

  const handlePushToSupabase = async () => {
    setIsPushing(true);
    
    try {
      const allMapped = scrapedData.map(c => ({
        code: c.course_code,
        section: c.section_number,
        faculty: c.faculty_initials,
        capacity: c.capacity,
        course_name: c.course_name,
        credits: c.credit_val,
        dedicated_department: c.dedicated_department,
        sessions: c.schedule_data
      }));

      const BATCH_SIZE = 400;
      const totalBatches = Math.ceil(allMapped.length / BATCH_SIZE);
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalDeleted = 0;
      let lastResult: any = null;

      let { data: { session } } = await supabase.auth.getSession();
      if (!session || (session.expires_at && session.expires_at * 1000 < Date.now() + 60000)) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) {
          session = refreshed.session;
        }
      }
      if (!session) {
        throw new Error("Admin session expired. Please log out and sign back in to the Admin Panel.");
      }

      for (let b = 0; b < totalBatches; b++) {
        const batchCourses = allMapped.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        addLog(`Syncing batch ${b + 1}/${totalBatches} (${batchCourses.length} courses)...`, 'info');

        const payload = {
          semester: semester,
          is_chunk: totalBatches > 1,
          is_last_chunk: b === totalBatches - 1,
          courses: batchCourses
        };

        const { data: result, error: syncError } = await supabase.functions.invoke('azure-admin-proxy', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          },
          body: {
            action: 'sync_api_courses',
            payload: payload
          }
        });

        if (syncError) {
          let errDetails = syncError.message || "Edge Function invocation failed";
          try {
            if (typeof (syncError as any).context === 'object' && (syncError as any).context !== null) {
              const bodyText = await (syncError as any).context.text();
              const parsed = JSON.parse(bodyText);
              if (parsed.error) errDetails = parsed.error;
            }
          } catch { }
          throw new Error(`Batch ${b + 1} failed: ${errDetails}`);
        }

        if (result && (result.status === 'ok' || result.status === 'success')) {
          totalInserted += (result.inserted || 0);
          totalUpdated += (result.updated || 0);
          totalDeleted += (result.deleted || 0);
          lastResult = result;
        } else {
          throw new Error(`Sync error on batch ${b + 1}: ${result?.error || result?.message || 'Unknown backend error'}`);
        }
      }

      addLog(`Database Sync Success! ${totalInserted} added, ${totalUpdated} updated. PDF generated & uploaded to Faculty List.`, 'success');
      
      try {
        await supabase.from('scraper_logs').insert({
          semester,
          added: totalInserted,
          updated: totalUpdated,
          deleted: totalDeleted,
          report: lastResult || {}
        });
      } catch (e) {
        console.warn("Client scraper_logs insert optional step skipped:", e);
      }

      refreshHistory();
    } catch (err: unknown) {
      const error = err as Error;
      addLog(`Sync error: ${error.message}`, 'error');
    } finally {
      setIsPushing(false);
    }
  };

  const refreshHistory = async () => {
    const { data: hist, error } = await supabase
      .from('scraper_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      addLog(`History fetch failed: ${error.message}`, 'error');
    } else if (hist) {
      setSyncHistory(hist);
    }
  };

  const handleGeneratePDFFromHistory = async (targetSemester: string, report?: any) => {
    console.log(`[PDF] Reconstruction triggered for: ${targetSemester}`);
    setHistoryLoading(targetSemester);
    
    try {
      // 1. Direct link opening if snapshot URL exists in sync report
      const snapshotUrl = report?.pdf_snapshot?.academic_pdf_url || report?.pdf_snapshot?.pdf_url;
      if (snapshotUrl) {
        addLog(`Opening uploaded PDF snapshot for ${targetSemester}...`, 'success');
        window.open(snapshotUrl, '_blank');
        setHistoryLoading(null);
        return;
      }

      addLog(`Initiating PDF reconstruction for ${targetSemester}...`, 'info');

      // 2. Fetch from Supabase courses_<semester> table
      const tableName = `courses_${targetSemester.toLowerCase().replace(/ /g, '')}`;
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) {
        console.error('[PDF] DB Fetch Error:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        addLog(`Database returned 0 records for "${targetSemester}". Cannot generate PDF.`, 'error');
        console.warn(`[PDF] No data found in 'courses' table for semester: ${targetSemester}`);
        return;
      }

      console.log(`[PDF] Found ${data.length} records. Formatting...`);

      // 3. Format rows properly mapping database column names
      const formattedData = data.map(c => ({
        course_code: c.course_code || c.code || '',
        course_name: c.course_name || '',
        section_number: String(c.section_number || c.section || ''),
        faculty_initials: c.faculty_initials || c.faculty || 'TBA',
        capacity: c.capacity || '0/0',
        credit_val: String(c.credit_val || c.credits || '3.0'),
        dedicated_department: String(c.dedicated_department || ''),
        schedule_data: (c.schedule_data || c.sessions || []) as Course['schedule_data']
      }));

      // 4. Trigger PDF Generation
      handleGeneratePDF(formattedData, targetSemester);
      addLog(`PDF successfully generated for ${targetSemester}. Check downloads.`, 'success');
    } catch (err: unknown) {
      const error = err as Error;
      console.error('[PDF] Generation Failed:', error);
      addLog(`PDF Failed: ${error.message}`, 'error');
    } finally {
      setHistoryLoading(null);
    }
  };

  const handleGeneratePDF = (dataOverride?: Course[] | React.MouseEvent, semesterOverride?: string) => {
    // If called directly via onClick, dataOverride will be a MouseEvent.
    // We only want to use dataOverride if it's a valid Array.
    const dataToUse = Array.isArray(dataOverride) ? dataOverride : scrapedData;
    const semToUse = typeof semesterOverride === 'string' ? semesterOverride : semester;

    if (!dataToUse || !dataToUse.length) {
      addLog("No data available to generate PDF.", "error");
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(240, 247, 255); doc.rect(10, 10, pageW - 20, 22, 'F');
    doc.setTextColor(30, 41, 59); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('East West University — Faculty List', pageW / 2, 18, { align: 'center' });
    
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    const subText = `Semester: ${semToUse}  |  Total: ${dataToUse.length}  |  Updated by `;
    const subTextWidth = doc.getTextWidth(subText);
    const totalWidth = subTextWidth + doc.getTextWidth('rxxeron');
    const startX = (pageW - totalWidth) / 2;
    
    doc.text(subText, startX, 23);
    doc.setTextColor(59, 130, 246); doc.setFont('helvetica', 'bold');
    doc.text('rxxeron', startX + subTextWidth, 23);
    doc.link(startX + subTextWidth, 21, doc.getTextWidth('rxxeron'), 3, { url: 'https://rxxeron.iam.bd' });
    
    doc.setTextColor(59, 130, 246); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Generated from EWUmate', pageW / 2, 27, { align: 'center' });
    
    // Timestamp on the right
    const now = new Date();
    const timestamp = `Issued: ${now.toLocaleDateString()} @ ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    doc.setTextColor(148, 163, 184);
    doc.text(timestamp, pageW - 12, 27, { align: 'right' });

    const sortedData = [...dataToUse].sort((a, b) => {
      const codeA = (a.course_code || '').toUpperCase();
      const codeB = (b.course_code || '').toUpperCase();
      
      const isA_CSE = codeA.startsWith('CSE');
      const isB_CSE = codeB.startsWith('CSE');
      const isA_ICE = codeA.startsWith('ICE');
      const isB_ICE = codeB.startsWith('ICE');

      if (isA_CSE && !isB_CSE) return -1;
      if (!isA_CSE && isB_CSE) return 1;
      if (isA_ICE && !isB_ICE) return -1;
      if (!isA_ICE && isB_ICE) return 1;

      return codeA.localeCompare(codeB);
    });

    const rows: Array<Array<string | number>> = [];
    sortedData.forEach((item) => {
      const sessions = item.schedule_data || [];
      const distinctTypes = Array.from(new Set(sessions.map((s) => s.type || 'Theory')));
      const typeLabel = distinctTypes.length === 1 ? distinctTypes[0] : distinctTypes.join('\n');
      
      rows.push([
        item.dedicated_department || '—',
        `${item.course_code}\n${item.course_name}`,
        item.section_number,
        item.faculty_initials || 'TBA',
        item.capacity,
        sessions.map((s) => `${s.day} ${s.startTime}-${s.endTime}`).join('\n'),
        sessions.map((s) => s.room).join('\n'),
        typeLabel
      ]);
    });

    // Properly handle different autoTable initiation methods to avoid
    // 'getTextColor' undefined errors in production minified builds.
    if (typeof autoTable === 'function') {
      autoTable(doc, {
        startY: 36,
        head: [['PROG', 'DESCRIPTION', 'SEC', 'FAC', 'CAP', 'SCHEDULE', 'ROOM', 'TYPE']],
        body: rows,
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
        styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
        headStyles: { fillColor: [219, 234, 254], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 10, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 35 },
          6: { cellWidth: 40, fontSize: 5.2 },
          7: { fontStyle: 'bold', textColor: [79, 70, 229], halign: 'center', cellWidth: 15 }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            data.cell.styles.valign = 'top';
          }
        }
      });
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable({
        startY: 36,
        head: [['PROG', 'DESCRIPTION', 'SEC', 'FAC', 'CAP', 'SCHEDULE', 'ROOM', 'TYPE']],
        body: rows,
        margin: { left: 10, right: 10 },
        tableWidth: 'auto',
        styles: { fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak' },
        headStyles: { fillColor: [219, 234, 254], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 10, halign: 'center' },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 35 },
          6: { cellWidth: 40, fontSize: 5.2 },
          7: { fontStyle: 'bold', textColor: [79, 70, 229], halign: 'center', cellWidth: 15 }
        },
        didParseCell: (data: any) => {
          if (data.section === 'body') {
            data.cell.styles.valign = 'top';
          }
        }
      });
    } else {
      console.error('[PDF] autoTable plugin not found.');
      addLog('PDF Generation Error: autoTable library missing.', 'error');
      return;
    }

    const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const timeStr = String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
    doc.save(`EWU_Faculty_List_${dateStr}_${timeStr}.pdf`);
  };

  const filteredData = scrapedData.filter(item => {
    const search = searchTerm.toLowerCase();
    return (
      item.course_code.toLowerCase().includes(search) ||
      item.course_name.toLowerCase().includes(search) ||
      item.faculty_initials.toLowerCase().includes(search)
    );
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-4 md:p-8 font-sans animate-in fade-in duration-500 transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-card rounded-3xl p-8 shadow-sm border border-border flex items-center justify-between transition-colors">
          <div className="flex items-center gap-6">
            <div className="p-4 bg-primary rounded-lg shadow-lg">
              <Globe className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">Portal Scraper <span className="text-primary dark:text-primary font-semibold">Pro</span></h1>
              <p className="text-muted-foreground text-sm font-medium mt-1">v2.5 Automated Extraction System</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-muted rounded-lg border border-border text-center">
              <div className="text-xl font-semibold text-foreground">{scrapedData.length}</div>
              <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Records Found</div>
            </div>
          </div>
        </div>

        {/* Top Systems Row (Horizontal Layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card rounded-3xl p-6 shadow-sm border border-border transition-colors">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-primary dark:text-primary" /> QA Protocol</h3>
            <div className="flex items-center justify-between gap-4">
              {[
                { t: 'Faculty', d: 'Initials Ok', c: 'bg-primary' },
                { t: 'Timing', d: 'Slots Ok', c: 'bg-primary' },
                { t: 'Conflict', d: 'Checked', c: 'bg-primary' }
              ].map((item, i) => (
                <div key={i} className="flex-1 flex gap-3 bg-muted p-3 rounded-lg border border-border">
                  <div className={`w-1 h-full rounded-full ${item.c}`} />
                  <div>
                    <h4 className="text-[9px] font-semibold text-foreground uppercase tracking-wider">{item.t}</h4>
                    <p className="text-[10px] text-muted-foreground font-bold">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`rounded-3xl p-6 text-white shadow-xl flex items-center justify-between transition-colors ${isAzureLive === 'live' ? 'bg-slate-900 dark:bg-indigo-900' : isAzureLive === 'checking' ? 'bg-slate-800' : 'bg-rose-900'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full animate-pulse ${isAzureLive === 'live' ? 'bg-primary' : isAzureLive === 'checking' ? 'bg-primary' : 'bg-rose-500'}`} />
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">System Pulse</span>
                <h4 className="font-bold text-sm">Azure Cloud Core: {isAzureLive.toUpperCase()}</h4>
              </div>
            </div>
            <button onClick={checkAzureHealth} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><Zap className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Mission Configuration */}
        <div className="bg-card rounded-3xl p-8 shadow-sm border border-border transition-colors">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-6 bg-primary dark:bg-indigo-400 rounded-full" />
            <h2 className="text-lg font-bold text-foreground">Mission Configuration</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="space-y-2 opacity-60 pointer-events-none">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Student ID (Auto)</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input type="text" value={id} disabled className="w-full bg-background border border-slate-100 dark:border-border rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-foreground" />
              </div>
            </div>
            <div className="space-y-2 opacity-60 pointer-events-none">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Portal Password (Auto)</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" />
                <input type="password" value="********" disabled className="w-full bg-background border border-slate-100 dark:border-border rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Target Semester</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 dark:text-slate-600" />
                <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full bg-background border border-slate-100 dark:border-border rounded-xl pl-11 pr-10 py-3 text-sm font-bold text-foreground focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-ring dark:focus:ring-ring outline-none appearance-none transition-all cursor-pointer">
                  {availableSemesters.map((s, idx) => <option key={`${s}-${idx}`} value={s} className="dark:bg-slate-800">{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          <button 
            onClick={handleStartScrape}
            disabled={status === 'running' || isAzureLive !== 'live'}
            className="w-full py-4 rounded-lg bg-primary dark:bg-primary hover:bg-primary/90 dark:hover:bg-primary text-white font-bold text-xs uppercase  flex items-center justify-center gap-3 transition-all shadow-lg dark:shadow-none active:scale-[0.98]"
          >
            {status === 'running' ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Processing Catalog...</span></> : <><Play className="w-4 h-4 fill-current" /><span>Execute Extraction</span></>}
          </button>
        </div>

        {/* Logs Console */}
        {logs.length > 0 && (
          <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-800 animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-4 text-primary dark:text-indigo-300">
              <Terminal className="w-5 h-5" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Extraction Logs</h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto font-mono text-[11px]">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4 border-b border-border pb-1">
                  <span className="text-white/30">[{log.time}]</span>
                  <span className={log.type === 'error' ? 'text-rose-400' : log.type === 'success' ? 'text-primary' : 'text-indigo-300'}>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extraction Results */}
        {scrapedData.length > 0 && (
          <div className="bg-card rounded-3xl overflow-hidden shadow-sm border border-border transition-colors">
            <div className="p-6 bg-background/50 border-b border-border flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary dark:bg-primary rounded-xl shadow-lg"><TableIcon className="w-5 h-5 text-white" /></div>
                <h3 className="text-xl font-semibold text-foreground">Extraction Results</h3>
              </div>
              
              <div className="flex-1 max-w-md mx-4">
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    type="text"
                    placeholder="Search by course code, name, or faculty..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-card border border-slate-200 dark:border-border rounded-lg pl-11 pr-4 py-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-ring dark:focus:ring-ring outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleGeneratePDF} className="px-5 py-3.5 bg-violet-500 hover:bg-violet-600 rounded-lg text-xs font-semibold text-white transition-all shadow-lg active:scale-95 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button onClick={handlePushToSupabase} disabled={isPushing} className="px-8 py-3.5 bg-primary hover:bg-primary rounded-lg text-xs font-semibold text-white transition-all shadow-lg active:scale-95 flex items-center gap-2">
                  {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />} SYNC TO DB
                </button>
              </div>
            </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-card sticky top-0 z-20 border-b-2 border-border shadow-sm text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-5 w-20">Prog</th>
                      <th className="px-4 py-5">Description</th>
                      <th className="px-4 py-5 text-center w-16">Sec</th>
                      <th className="px-4 py-5 w-20">Faculty</th>
                      <th className="px-4 py-5 w-24">Capacity</th>
                      <th className="px-4 py-5">Schedule & Room</th>
                      <th className="px-4 py-5 text-center w-24">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {filteredData.map((item, idx) => {
                      const distinctTypes = Array.from(new Set(item.schedule_data?.map((s) => s.type || 'Theory')));
                      return (
                        <tr key={idx} className="hover:bg-accent hover:text-accent-foreground transition-colors group text-[11px]">
                          <td className="px-4 py-4">
                            <span className="font-semibold bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary px-2 py-1 rounded-lg uppercase border border-primary/20 dark:border-primary/20">
                              {item.dedicated_department || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-foreground">{item.course_code}</div>
                            <div className="text-[10px] text-muted-foreground font-bold truncate max-w-[150px]" title={item.course_name}>{item.course_name}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="w-8 h-8 mx-auto flex items-center justify-center bg-muted rounded-lg font-semibold border border-slate-100 dark:border-border text-foreground">{item.section_number}</div>
                          </td>
                          <td className="px-4 py-4 font-semibold text-primary dark:text-primary uppercase">{item.faculty_initials || 'TBA'}</td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-foreground mb-1">{item.capacity}</div>
                            <div className="w-16 bg-slate-100 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                              {(() => {
                                const [curr, tot] = (item.capacity || '0/0').split('/').map(Number);
                                const perc = tot > 0 ? (curr / tot) * 100 : 0;
                                return <div className={`h-full ${perc > 90 ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${perc}%` }} />;
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1.5">
                              {item.schedule_data?.map((s, sIdx: number) => (
                                <div key={sIdx} className="flex items-center gap-4 py-1 border-b border-border last:border-0">
                                  <div className="w-[120px] font-bold text-muted-foreground">{s.day} {s.startTime}-{s.endTime}</div>
                                  <div className="font-semibold text-primary dark:text-indigo-300">{s.room}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 dark:border-primary/20 text-center uppercase text-[9px]">
                              {distinctTypes.join(' / ')}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          </div>
        )}

        {/* Sync History */}
        <div className="bg-card rounded-3xl p-8 shadow-sm border border-border transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-lg">
                <History className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Activity Feed</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Recent Portal Syncs</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={refreshHistory}
                className="p-2 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/10 rounded-xl transition-all"
                title="Refresh History"
              >
                <History className="w-4 h-4" />
              </button>
              {syncHistory.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-primary/10 rounded-full border border-primary/20 dark:border-primary/20">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-[10px] font-semibold text-primary dark:text-primary uppercase">Live Audit</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {syncHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-muted rounded-lg border border-dashed border-slate-200 dark:border-border">
                <History className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-muted-foreground text-sm font-medium">No sync records found yet.</p>
                <p className="text-[10px] text-slate-300 dark:text-slate-700 uppercase font-semibold mt-1 tracking-tighter">History will appear after your first sync</p>
              </div>
            ) : (
              syncHistory.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border hover:border-primary/20 dark:hover:border-primary/20 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 flex items-center justify-center bg-muted rounded-xl group-hover:bg-primary/10 dark:group-hover:bg-primary/10 transition-colors">
                      <Database className="w-6 h-6 text-slate-400 dark:text-slate-600 group-hover:text-primary dark:group-hover:text-primary transition-colors" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                        {h.semester}
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded text-muted-foreground font-bold">STABLE</span>
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                        {new Date(h.created_at).toLocaleDateString()} @ {new Date(h.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex gap-4 border-r border-border pr-6">
                      <div className="text-center">
                        <div className="text-primary dark:text-primary font-semibold text-xs">+{h.added}</div>
                        <div className="text-[8px] font-semibold text-slate-300 dark:text-slate-600 uppercase">New</div>
                      </div>
                      <div className="text-center">
                        <div className="text-primary dark:text-primary font-semibold text-xs">~{h.updated}</div>
                        <div className="text-[8px] font-semibold text-slate-300 dark:text-slate-600 uppercase">Mods</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleGeneratePDFFromHistory(h.semester, h.report)}
                      disabled={historyLoading === h.semester}
                      className={`p-2.5 rounded-xl text-white shadow-lg shadow-sm transition-all cursor-pointer ${
                        historyLoading === h.semester 
                          ? 'bg-slate-400 animate-pulse cursor-wait' 
                          : 'bg-primary hover:bg-primary/90 active:scale-95'
                      }`}
                      title="Download Full Report"
                    >
                      {historyLoading === h.semester ? (
                         <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
