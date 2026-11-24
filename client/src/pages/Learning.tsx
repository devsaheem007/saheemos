import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { ResourcePage } from '../components/ResourcePage';
import { FormModal } from '../components/FormModal';
import { api, dateStr } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { R } from '../lib/resources';

// Students submit work from the assignments list; teachers grade on the Submissions page.
export function AssignmentsPage() {
  const { user } = useAuth(); const [a, setA] = useState<any>(null);
  return (<>
    <ResourcePage cfg={R.assignments} renderActions={(row) => user!.role === 'student' ? <button className="btn-ghost !px-2" onClick={() => setA(row)}><Send size={14} />Submit</button> : null} />
    <AnimatePresence>{a && <FormModal title={`Submit: ${a.title}`} submitLabel="Submit work" onClose={() => setA(null)}
      fields={[{ name: 'text', label: 'Your answer', type: 'textarea' }, { name: 'file', label: 'Attach a file', type: 'file' }]}
      onSubmit={async (v) => { await api.post('/submissions', { assignment: a._id, text: v.text, file: v.file }); toast.ok(`Submitted${new Date() > new Date(a.dueDate) ? ' (marked late)' : ''}. Due ${dateStr(a.dueDate)}`); }} />}</AnimatePresence>
  </>);
}
