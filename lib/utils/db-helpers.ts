/**
 * Database Helper Utilities
 * Common database operations
 */

import { pool }from "@/lib/db";
import { AppError, ErrorTypes } from "./error-handler";

/**
 * Ensure table exists
 */
export async function ensureTable(
  tableName: string,
  createTableSQL: string
): Promise<void> {
  try {
    await pool.query(createTableSQL);
  }catch (error: any) {
    if (!error.message.includes("already exists")) {
      throw new AppError(
        `Failed to create table ${tableName}`,
        ErrorTypes.DATABASE_ERROR.code,
        ErrorTypes.DATABASE_ERROR.statusCode,
        { originalError: error.message }
      );
    }
  }
}

/**
 * Execute query with error handling
 */
export async function executeQuery(
  query: string,
  params: any[] = []
): Promise<any> {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error: any) {
    throw new AppError(
      "Database query failed",
      ErrorTypes.DATABASE_ERROR.code,
      ErrorTypes.DATABASE_ERROR.statusCode,
      { query, params, originalError: error.message }
    );
  }
}

/**
 * Get single row
 */
export async function getOne(
  query: string,
  params: any[] = []
): Promise<any> {
  const result = await executeQuery(query, params);
  if (result.rows.length === 0) {
    throw new AppError(
      "Record not found",
      ErrorTypes.NOT_FOUND.code,
      ErrorTypes.NOT_FOUND.statusCode
    );
  }
  return result.rows[0];
}

/**
 * Get multiple rows
 */
export async function getMany(
  query: string,
  params: any[] = []
): Promise<any[]> {
  const result = await executeQuery(query, params);
  return result.rows;
}

/**
 * Insert record
 */
export async function insert(
  query: string,
  params: any[] = []
): Promise<any> {
  const result = await executeQuery(query, params);
  if (result.rows.length === 0) {
    throw new AppError(
      "Insert failed",
      ErrorTypes.DATABASE_ERROR.code,
      ErrorTypes.DATABASE_ERROR.statusCode
    );
  }
  return result.rows[0];
}

/**
 * Update record
 */
export async function update(
  query: string,
  params: any[] = []
): Promise<any> {
  const result = await executeQuery(query, params);
  if (result.rowCount === 0) {
    throw new AppError(
      "Record not found",
      ErrorTypes.NOT_FOUND.code,
      ErrorTypes.NOT_FOUND.statusCode
    );
  }
  return result.rows[0];
}

/**
 * Delete record
 */
export async function deleteRecord(
  query: string,
  params: any[] = []
): Promise<void> {
  const result = await executeQuery(query, params);
  if (result.rowCount === 0) {
    throw new AppError(
      "Record not found",
      ErrorTypes.NOT_FOUND.code,
      ErrorTypes.NOT_FOUND.statusCode
    );
  }
}

/**
 * Get count
 */
export async function getCount(
  query: string,
  params: any[] = []
): Promise<number> {
  const result = await executeQuery(query, params);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Paginate results
 */
export async function paginate(
  query: string,
  countQuery: string,
  params: any[],
  countParams: any[],
  page: number = 1,
  limit: number = 10
): Promise<{
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const offset = (page - 1) * limit;

  const [itemsResult, countResult] = await Promise.all([
    executeQuery(`${query} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
      ...params,
      limit,
      offset,
    ]),
    executeQuery(countQuery, countParams),
  ]);

  const total = parseInt(
    countResult.rows[0].count || countResult.rows[0].total,
    10
  );

  return {
    items: itemsResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
