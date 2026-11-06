import { useQuery } from '@tanstack/react-query';
import { Download, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { evidenceUrl, listEvidence } from '@/lib/claim-storage';

export function EvidenceFiles({ userId, claimUuid }: { userId: string; claimUuid: string }) {
  const files = useQuery({ queryKey: ['evidence', userId, claimUuid], queryFn: () => listEvidence(userId, claimUuid) });
  async function open(path: string) {
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await evidenceUrl(path);
      if (tab) tab.location.href = url;
      else toast.error('Allow pop-ups to open attached evidence');
    } catch {
      tab?.close();
      toast.error('Evidence could not be opened. Please retry.');
    }
  }
  return <section className="mb-6 border-b border-border pb-4 print:hidden" aria-label="Attached evidence">
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Paperclip className="size-4" />Attached evidence</h3>
    {files.isPending ? <p className="text-sm text-muted-foreground">Loading attachments…</p> : files.isError ? <div className="flex items-center gap-3"><p role="alert" className="text-sm text-danger">Attachments could not load.</p><Button size="sm" variant="outline" onClick={() => void files.refetch()}>Retry</Button></div> : !files.data?.length ? <p className="text-sm text-muted-foreground">No attached files.</p> : <ul className="divide-y divide-border">
      {files.data.map(file => <li key={file.path} className="flex items-center justify-between gap-3 py-2">
        <span className="min-w-0 break-all text-sm">{file.name}</span>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => void open(file.path)} aria-label={`Open or download ${file.name}`}><Download className="size-4" />Open / download</Button>
      </li>)}
    </ul>}
  </section>;
}