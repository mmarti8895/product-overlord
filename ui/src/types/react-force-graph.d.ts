/**
 * Minimal type shim for react-force-graph (no official @types package).
 */
declare module "react-force-graph" {
  import type { MutableRefObject } from "react";

  interface NodeObject {
    id: string | number;
    x?: number;
    y?: number;
    z?: number;
    [key: string]: unknown;
  }

  interface LinkObject {
    source: string | number | NodeObject;
    target: string | number | NodeObject;
    [key: string]: unknown;
  }

  interface ForceGraphMethods {
    d3Force(force: string): unknown;
    zoomToFit(duration?: number, padding?: number): void;
    centerAt(x?: number, y?: number, duration?: number): void;
    zoom(k?: number, duration?: number): void;
  }

  interface ForceGraph2DProps {
    graphData?: { nodes: NodeObject[]; links: LinkObject[] };
    nodeId?: string;
    nodeLabel?: string | ((node: NodeObject) => string);
    nodeColor?: string | ((node: NodeObject) => string);
    nodeVal?: string | number | ((node: NodeObject) => number);
    linkColor?: string | ((link: LinkObject) => string);
    linkLabel?: string | ((link: LinkObject) => string);
    linkDirectionalArrowLength?: number;
    linkDirectionalArrowRelPos?: number;
    width?: number;
    height?: number;
    backgroundColor?: string;
    onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
    nodeCanvasObject?: (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    ref?: MutableRefObject<ForceGraphMethods | undefined>;
    [prop: string]: unknown;
  }

  export const ForceGraph2D: React.ComponentType<ForceGraph2DProps>;
  export const ForceGraph3D: React.ComponentType<ForceGraph2DProps>;
  export type { ForceGraphMethods, NodeObject, LinkObject };
}
