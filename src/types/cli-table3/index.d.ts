declare module 'cli-table3' {
  interface TableOptions {
    head?: string[];
    colWidths?: number[];
    colAligns?: string[];
    style?: {
      head?: any[];
      border?: any[];
      [key: string]: any;
    };
    chars?: {
      [key: string]: string;
    };
    [key: string]: any;
  }

  class Table {
    constructor(options?: TableOptions);
    push(...rows: any[]): number;
    toString(): string;
  }

  export = Table;
} 