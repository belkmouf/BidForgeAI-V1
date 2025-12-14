import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useCallback, useState } from 'react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { cn } from '@/lib/utils';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2, 
  Undo, 
  Redo,
  Table as TableIcon,
  Highlighter,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const ATTENTION_PATTERNS = [
  /\[TO BE PROVIDED\]/gi,
  /\[INSERT[^\]]*\]/gi,
  /\[YOUR[^\]]*\]/gi,
  /\[ENTER[^\]]*\]/gi,
  /\[ADD[^\]]*\]/gi,
  /\[SPECIFY[^\]]*\]/gi,
  /\[COMPLETE[^\]]*\]/gi,
  /\[FILL[^\]]*\]/gi,
  /\[TBD\]/gi,
  /\[TODO[^\]]*\]/gi,
  /\[PLACEHOLDER[^\]]*\]/gi,
  /\[MISSING[^\]]*\]/gi,
  /\[REQUIRED[^\]]*\]/gi,
  /\[UPDATE[^\]]*\]/gi,
  /\[REVIEW[^\]]*\]/gi,
  /\[ATTENTION[^\]]*\]/gi,
  /\[ACTION[^\]]*\]/gi,
  /XXX+/g,
  /___+/g,
];

interface TiptapEditorProps {
  content: string;
  onChange?: (content: string) => void;
}

interface MenuBarProps {
  editor: any;
  attentionCount: number;
  onHighlightAttention: () => void;
}

const MenuBar = ({ editor, attentionCount, onHighlightAttention }: MenuBarProps) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-border p-2 flex flex-wrap gap-1 bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('bold') ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-bold"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('italic') ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-italic"
      >
        <Italic className="h-4 w-4" />
      </Button>
      
      <div className="w-px h-6 bg-border mx-1 self-center" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 1 }) ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-heading1"
      >
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn("h-8 w-8 p-0", editor.isActive('heading', { level: 2 }) ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-heading2"
      >
        <Heading2 className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('bulletList') ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-bullet-list"
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('orderedList') ? "bg-accent text-accent-foreground" : "")}
        data-testid="button-ordered-list"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className="h-8 w-8 p-0"
        data-testid="button-insert-table"
      >
        <TableIcon className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border mx-1 self-center" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onHighlightAttention}
              className={cn(
                "h-8 px-2 gap-1.5",
                attentionCount > 0 ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : ""
              )}
              data-testid="button-highlight-attention"
            >
              <Highlighter className="h-4 w-4" />
              {attentionCount > 0 && (
                <span className="text-xs font-medium">{attentionCount}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{attentionCount > 0 ? `${attentionCount} areas need attention` : 'No areas need attention'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={cn("h-8 w-8 p-0", editor.isActive('highlight') ? "bg-yellow-200 text-yellow-800" : "")}
        data-testid="button-toggle-highlight"
      >
        <span className="h-4 w-4 rounded bg-yellow-300 border border-yellow-400" />
      </Button>

      <div className="flex-1" />

      {attentionCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-amber-700 text-xs mr-2">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{attentionCount} area{attentionCount !== 1 ? 's' : ''} need attention</span>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="h-8 w-8 p-0"
        data-testid="button-undo"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="h-8 w-8 p-0"
        data-testid="button-redo"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
};

function countAttentionAreas(text: string): number {
  let count = 0;
  for (const pattern of ATTENTION_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

function highlightAttentionAreasInHtml(html: string): string {
  let result = html;
  for (const pattern of ATTENTION_PATTERNS) {
    result = result.replace(pattern, (match) => `<mark data-color="attention" style="background-color: rgb(254 243 199); border-bottom: 2px solid rgb(245 158 11);">${match}</mark>`);
  }
  return result;
}

export function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const [attentionCount, setAttentionCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: 'Start writing your bid proposal...',
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'highlight-attention',
        },
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[500px] p-8 max-w-none',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      const textContent = editor.getText();
      setAttentionCount(countAttentionAreas(textContent));
    },
  });

  useEffect(() => {
    if (editor) {
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content);
      }
      const textContent = editor.getText();
      setAttentionCount(countAttentionAreas(textContent));
    }
  }, [content, editor]);

  const handleHighlightAttention = useCallback(() => {
    if (!editor) return;
    
    const currentHtml = editor.getHTML();
    const highlightedHtml = highlightAttentionAreasInHtml(currentHtml);
    
    if (highlightedHtml !== currentHtml) {
      editor.commands.setContent(highlightedHtml);
      onChange?.(highlightedHtml);
    }
  }, [editor, onChange]);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      <style>{`
        .highlight-attention {
          background-color: rgb(254 243 199) !important;
          border-bottom: 2px solid rgb(245 158 11);
          padding: 0 2px;
          border-radius: 2px;
        }
        .ProseMirror mark[data-color="attention"] {
          background-color: rgb(254 243 199) !important;
          border-bottom: 2px solid rgb(245 158 11);
          padding: 0 2px;
          border-radius: 2px;
        }
        .ProseMirror mark {
          background-color: rgb(254 240 138);
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
      <MenuBar 
        editor={editor} 
        attentionCount={attentionCount}
        onHighlightAttention={handleHighlightAttention}
      />
      <div className="flex-1 overflow-y-auto bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}