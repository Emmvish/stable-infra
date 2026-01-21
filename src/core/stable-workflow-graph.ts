import {
  WorkflowGraph,
  WorkflowGraphOptions,
  STABLE_WORKFLOW_RESULT
} from '../types/index.js';
import { executeWorkflowGraph } from '../utilities/index.js';

export async function stableWorkflowGraph<RequestDataType = any, ResponseDataType = any, FunctionArgsType extends any[] = any[], FunctionReturnType = any>(
  graph: WorkflowGraph<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType>,
  options: WorkflowGraphOptions<RequestDataType, ResponseDataType, FunctionArgsType, FunctionReturnType> = {}
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType, FunctionReturnType, RequestDataType, FunctionArgsType>> {
  return executeWorkflowGraph(graph, options);
}
