"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileCode2, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

interface Entry {
  path: string;
  size: number;
}
interface Node {
  name: string;
  path: string;
  children?: Node[];
}

function buildTree(files: Entry[]): Node[] {
  const root: Node = { name: "", path: "", children: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      cur.children ??= [];
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path: parts.slice(0, i + 1).join("/"), children: isFile ? undefined : [] };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  const sort = (nodes: Node[]): Node[] =>
    nodes
      .sort((a, b) => (!!b.children === !!a.children ? a.name.localeCompare(b.name) : b.children ? 1 : -1))
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));
  return sort(root.children ?? []);
}

export function FileTree({ projectId, version, selected, onSelect }: { projectId: string; version: number; selected: string | null; onSelect: (p: string) => void }) {
  const [files, setFiles] = useState<Entry[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => setFiles(d.files ?? []))
      .catch(() => undefined);
  }, [projectId, version]);
  const tree = useMemo(() => buildTree(files), [files]);

  return (
    <div className="py-2 text-[12.5px]">
      {tree.map((n) => (
        <TreeNode key={n.path} node={n} depth={0} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, selected, onSelect }: { node: Node; depth: number; selected: string | null; onSelect: (p: string) => void }) {
  const [open, setOpen] = useState(depth < 2);
  const pad = { paddingLeft: 10 + depth * 12 };
  if (node.children) {
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 py-1 pr-2 text-muted hover:text-fg" style={pad}>
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          <Folder className="size-3.5 text-subtle" />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children.map((c) => <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />)}
      </div>
    );
  }
  const Icon = /\.(tsx?|jsx?|css|html)$/.test(node.name) ? FileCode2 : FileText;
  return (
    <button
      onClick={() => onSelect(node.path)}
      className={cn("flex w-full items-center gap-1.5 py-1 pr-2 text-left", selected === node.path ? "bg-elevated text-fg" : "text-muted hover:text-fg")}
      style={{ paddingLeft: 10 + depth * 12 + 15 }}
    >
      <Icon className="size-3.5 shrink-0 text-subtle" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}
