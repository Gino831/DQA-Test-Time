
export enum CategoryType {
  CHAMBER = 'Chamber 應用',
  VIB_SHOCK = '振動衝擊應用',
  IP_TEST = 'IP 防護測試',
  FUNCTION = '功能測試',
  OTHER = '其他測試'
}

export interface TestItem {
  id: string;
  name: string;
  duration: number; // in days
  category: CategoryType;
}

export interface StandardData {
  id: string;
  name: string;
  description: string;
  icon: string;
  categories: {
    [key in CategoryType]?: TestItem[];
  };
}

export enum ExecutionStrategy {
  SERIAL = 'SERIAL', // 樣品沿用 (接續測試)
  PARALLEL = 'PARALLEL' // 樣品平行 (增加樣品)
}

export interface SelectedTests {
  [standardId: string]: {
    [itemId: string]: boolean;
  };
}

export interface CategoryResult {
  category: CategoryType;
  duration: number;
  testCount: number;
  sampleCount: number;
  items: TestItem[];
}
