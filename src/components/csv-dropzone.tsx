"use client";

import { useRef, useState, type DragEvent } from "react";
import { UploadCloud, FileText } from "lucide-react";

export function CsvDropzone({
  fileInputName,
  textareaName,
  rows = 16,
  placeholder,
}: {
  fileInputName: string;
  textareaName: string;
  rows?: number;
  placeholder?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function applyFile(file: File) {
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setFileName(file.name);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  return (
    <div className="flex flex-col gap-2 flex-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-md px-3 py-3 text-xs cursor-pointer transition-colors ${
          dragOver ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-500 hover:border-indigo-400"
        }`}
      >
        {fileName ? (
          <>
            <FileText className="size-4 shrink-0" /> {fileName}(クリックで変更)
          </>
        ) : (
          <>
            <UploadCloud className="size-4 shrink-0" /> CSVファイルをドラッグ&ドロップ、またはクリックして選択
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        name={fileInputName}
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
      <p className="text-xs text-slate-400 text-center">または下に直接貼り付け</p>
      <textarea
        name={textareaName}
        rows={rows}
        placeholder={placeholder}
        className="w-full border border-slate-300 rounded-md px-3 py-2 text-xs font-mono flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
