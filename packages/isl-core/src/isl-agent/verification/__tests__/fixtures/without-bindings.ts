// ============================================================================
// Test Fixture: Implementation WITHOUT @isl-bindings (heuristic fallback)
// ============================================================================

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const products: Map<string, Product> = new Map();

// This implementation has NO @isl-bindings block
// Verifier should fall back to heuristic matching

export function createProduct(name: string, price: number): Product {
  // Guard-like: validation
  if (!name || name.length === 0) {
    throw new Error('Product name required');
  }
  
  if (price <= 0) {
    throw new Error('Price must be positive');
  }

  const product: Product = {
    id: crypto.randomUUID(),
    name,
    price,
    stock: 0,
  };

  products.set(product.id, product);
  
  // Assert-like: verification
  const created = products.get(product.id);
  if (!created) {
    throw new Error('Failed to create product');
  }

  return product;
}

export function updateStock(productId: string, quantity: number): void {
  const product = products.get(productId);
  
  // Guard: product exists
  if (!product) {
    throw new Error('Product not found');
  }
  
  // Guard: quantity valid
  if (quantity < 0 && Math.abs(quantity) > product.stock) {
    throw new Error('Insufficient stock');
  }

  product.stock += quantity;
  
  // Assert: stock non-negative
  if (product.stock < 0) {
    throw new Error('Stock became negative');
  }
}
