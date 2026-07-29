import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createUserSupabaseClient } from "@/lib/supabase/server";
import type { RpcError, RpcResult, RpcSqlState } from "./types";

const SQLSTATE_TO_HTTP_STATUS: Record<string, number> = {
  PA001: 403,
  PN001: 404,
  PE001: 409,
  PV001: 422,
  PC001: 409
};

export function normalizeRpcError(error: {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
}): RpcError {
  const code = error.code ?? "UNKNOWN";

  return {
    code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    httpStatus: SQLSTATE_TO_HTTP_STATUS[code] ?? 500
  };
}

export async function rpcCall<T>(
  functionName: string,
  params?: Record<string, unknown>,
  client?: SupabaseClient
): Promise<RpcResult<T>> {
  const supabase = client ?? (await createUserSupabaseClient());
  const { data, error } = await supabase.rpc(functionName, params ?? {});

  if (error) {
    return {
      data: null,
      error: normalizeRpcError(error)
    };
  }

  return {
    data: data as T,
    error: null
  };
}

export function unwrapRpcResult<T>(result: RpcResult<T>): T {
  if (result.error) {
    const error = new Error(result.error.message) as Error & { code?: RpcSqlState | string; httpStatus?: number };
    error.code = result.error.code;
    error.httpStatus = result.error.httpStatus;
    throw error;
  }

  return result.data as T;
}

