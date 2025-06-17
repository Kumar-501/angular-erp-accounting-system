// MODEL: discount.model.ts
export interface Discount {
    id?: string;
    name: string;
    products: string;
    brand: string;
    category: string;
    location: string;
    priority: string;
    discountType: string;
    discountAmount: number;
    startsAt: Date;
    endsAt: Date;
    sellingPriceGroup: string;
    applyInCustomerGroups: boolean;
    isActive: boolean;
  }