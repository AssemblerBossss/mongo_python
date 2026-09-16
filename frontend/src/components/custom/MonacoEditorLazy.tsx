'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { loader } from '@monaco-editor/react';
import type { ComponentProps } from 'react';

/**
 * Monaco Editor configured for Next.js.
 *
 * The default @monaco-editor/react loader can try to resolve Monaco workers in a
 * way that fails in Next.js/Turbopack environments and surfaces as:
 *   Monaco initialization: error: [object Event]
 *
 * We copy monaco-editor/min/vs to public/monaco/vs in postinstall and force the
 * loader to use that local path. This keeps syntax colors/autocomplete while
 * avoiding CDN/worker loading issues.
 */
loader.config({
  paths: {
    vs: '/monaco/vs',
  },
});

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-[#1e1e1e] min-h-[160px]">
        <Loader2 className="animate-spin text-gray-400 mr-2" size={20} />
        <span className="text-gray-400 text-sm">Loading editor…</span>
      </div>
    ),
  }
);

export type MonacoEditorLazyProps = ComponentProps<typeof MonacoEditor>;

export default MonacoEditor;
