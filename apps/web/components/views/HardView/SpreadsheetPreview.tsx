"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, Table2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

interface SpreadsheetPreviewProps {
  fileUrl: string;
  fileName: string;
}

interface SheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  headers: string[];
}

export function SpreadsheetPreview({ fileUrl, fileName }: SpreadsheetPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    const fetchAndParseFile = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Add inline=true to get content without triggering download
        const urlWithInline = fileUrl.includes('?') ? `${fileUrl}&inline=true` : `${fileUrl}?inline=true`;
        const response = await fetch(urlWithInline);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        
        const ext = fileName.split('.').pop()?.toLowerCase();
        
        if (ext === 'csv') {
          // Parse CSV
          const text = await response.text();
          const rows = parseCSV(text);
          const headers = rows.length > 0 ? rows[0].map((_, i) => `Column ${i + 1}`) : [];
          setSheets([{ name: 'Sheet1', data: rows, headers }]);
        } else {
          // Parse Excel (xlsx, xls)
          const arrayBuffer = await response.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          
          const parsedSheets: SheetData[] = workbook.SheetNames.map(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, { 
              header: 1,
              defval: null 
            });
            
            // Get headers from first row or generate column names
            const headers = jsonData.length > 0 
              ? (jsonData[0] as (string | number | boolean | null)[]).map((h, i) => 
                  h !== null && h !== undefined ? String(h) : `Column ${i + 1}`
                )
              : [];
            
            return {
              name: sheetName,
              data: jsonData as (string | number | boolean | null)[][],
              headers
            };
          });
          
          setSheets(parsedSheets);
        }
      } catch (err) {
        console.error('Error parsing spreadsheet:', err);
        setError(err instanceof Error ? err.message : 'Failed to parse file');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAndParseFile();
  }, [fileUrl, fileName]);

  // Simple CSV parser
  const parseCSV = (text: string): (string | number | boolean | null)[][] => {
    const lines = text.split(/\r?\n/);
    const result: (string | number | boolean | null)[][] = [];
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      const row: (string | number | boolean | null)[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(parseValue(current.trim()));
          current = '';
        } else {
          current += char;
        }
      }
      row.push(parseValue(current.trim()));
      result.push(row);
    }
    
    return result;
  };

  // Parse string value to appropriate type
  const parseValue = (value: string): string | number | boolean | null => {
    if (value === '' || value === 'null' || value === 'NULL') return null;
    if (value === 'true' || value === 'TRUE') return true;
    if (value === 'false' || value === 'FALSE') return false;
    const num = Number(value);
    if (!isNaN(num) && value !== '') return num;
    return value;
  };

  // Get current sheet data
  const currentSheet = sheets[activeSheet];
  
  // Filter and paginate data
  const filteredData = useMemo(() => {
    if (!currentSheet) return [];
    
    let data = currentSheet.data;
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(row => 
        row.some(cell => 
          cell !== null && String(cell).toLowerCase().includes(query)
        )
      );
    }
    
    return data;
  }, [currentSheet, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeSheet]);

  // Get max columns across all rows
  const maxColumns = useMemo(() => {
    if (!currentSheet) return 0;
    return Math.max(...currentSheet.data.map(row => row.length), 0);
  }, [currentSheet]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-muted/20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading spreadsheet...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-destructive/10">
        <p className="text-sm text-destructive">{error}</p>
        <a 
          href={fileUrl}
          download={fileName}
          className="inline-block mt-2 text-xs text-primary hover:underline"
        >
          Download instead
        </a>
      </div>
    );
  }

  if (sheets.length === 0 || !currentSheet) {
    return (
      <div className="p-6 text-center bg-muted/20">
        <p className="text-sm text-muted-foreground">No data found in file</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
        {/* Sheet Tabs (if multiple sheets) */}
        {sheets.length > 1 && (
          <div className="flex items-center gap-1 mr-4">
            {sheets.map((sheet, idx) => (
              <Button
                key={sheet.name}
                variant={activeSheet === idx ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-3",
                  activeSheet === idx && "bg-primary/10 text-primary"
                )}
                onClick={() => setActiveSheet(idx)}
              >
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {sheet.name}
              </Button>
            ))}
          </div>
        )}
        
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs pl-8 pr-2"
          />
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Table2 className="h-3.5 w-3.5" />
          <span>{filteredData.length} rows × {maxColumns} cols</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto max-h-[500px]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/70 backdrop-blur-sm">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground border-b border-r bg-muted/80 w-12">
                #
              </th>
              {Array.from({ length: maxColumns }).map((_, colIdx) => (
                <th 
                  key={colIdx}
                  className="px-3 py-2 text-left text-xs font-semibold text-foreground border-b border-r bg-muted/70 min-w-[100px] max-w-[300px]"
                >
                  {currentSheet.headers[colIdx] || getColumnLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIdx) => {
              const actualRowIndex = (currentPage - 1) * rowsPerPage + rowIdx + 1;
              return (
                <tr 
                  key={rowIdx} 
                  className={cn(
                    "hover:bg-primary/5 transition-colors",
                    rowIdx % 2 === 0 ? "bg-background" : "bg-muted/20"
                  )}
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground border-b border-r font-mono bg-muted/30">
                    {actualRowIndex}
                  </td>
                  {Array.from({ length: maxColumns }).map((_, colIdx) => {
                    const cellValue = row[colIdx];
                    const displayValue = formatCellValue(cellValue);
                    const isNumber = typeof cellValue === 'number';
                    const isNull = cellValue === null;
                    
                    return (
                      <td 
                        key={colIdx}
                        className={cn(
                          "px-3 py-2 border-b border-r truncate max-w-[300px]",
                          isNumber && "text-right font-mono",
                          isNull && "text-muted-foreground/50 italic"
                        )}
                        title={String(cellValue ?? '')}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t">
          <span className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredData.length)} of {filteredData.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs px-2">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: Get Excel-style column letter (A, B, C, ..., AA, AB, ...)
function getColumnLetter(index: number): string {
  let result = '';
  let temp = index;
  
  while (temp >= 0) {
    result = String.fromCharCode(65 + (temp % 26)) + result;
    temp = Math.floor(temp / 26) - 1;
  }
  
  return result;
}

// Helper: Format cell value for display
function formatCellValue(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    // Format numbers with appropriate precision
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}
