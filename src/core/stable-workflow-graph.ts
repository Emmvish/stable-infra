import {
  WorkflowGraph,
  WorkflowGraphOptions,
  STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { executeWorkflowGraph } from '../utilities/index.js';

export async function stableWorkflowGraph<RequestDataType = any, ResponseDataType = any>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>> {
  return executeWorkflowGraph(graph, options);
}
