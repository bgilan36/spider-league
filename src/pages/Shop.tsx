import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Star } from "lucide-react";
import { useState } from "react";
import shopShortSleeve from "@/assets/shop-short-sleeve.png";
import shopLongSleeve from "@/assets/shop-long-sleeve.png";
import shopHoodie from "@/assets/shop-hoodie.png";
import shopKoozie from "@/assets/shop-koozie.png";
import shopStickers from "@/assets/shop-stickers.png";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

const Shop = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const products: Product[] = [
    {
      id: "tshirt-short",
      name: "Spider League Short Sleeve T-Shirt",
      description: "Premium cotton t-shirt featuring the iconic Spider League logo. Perfect for everyday wear or showing your spider battle pride.",
      price: 24.99,
      image: shopShortSleeve,
      category: "apparel"
    },
    {
      id: "tshirt-long",
      name: "Spider League Long Sleeve T-Shirt", 
      description: "Comfortable long sleeve tee with Spider League branding. Great for cooler weather or layering.",
      price: 29.99,
      image: shopLongSleeve,
      category: "apparel"
    },
    {
      id: "hoodie-zip",
      name: "Spider League Full-Zip Hoodie",
      description: "Premium fleece hoodie with full zip and Spider League embroidered logo. The ultimate in comfort and style.",
      price: 54.99,
      image: shopHoodie,
      category: "apparel"
    },
    {
      id: "koozie",
      name: "Spider League Beer Can Koozie",
      description: "Keep your drinks cold while representing the Spider League. Fits standard 12oz cans perfectly.",
      price: 9.99,
      image: shopKoozie,
      category: "accessories"
    },
    {
      id: "stickers",
      name: "Spider League Sticker Pack",
      description: "High-quality vinyl sticker pack featuring various Spider League designs. Weather-resistant and perfect for laptops, water bottles, and more.",
      price: 7.99,
      image: shopStickers,
      category: "accessories"
    }
  ];

  const categories = [
    { id: "all", name: "All Products" },
    { id: "apparel", name: "Apparel" },
    { id: "accessories", name: "Accessories" }
  ];

  const filteredProducts = selectedCategory === "all" 
    ? products 
    : products.filter(product => product.category === selectedCategory);

  const handleAddToCart = (product: Product) => {
    // TODO: Implement cart functionality and Stripe integration
    console.log("Add to cart:", product);
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Shop — Spider League</title>
        <meta name="description" content="Get official Spider League merchandise including t-shirts, hoodies, koozies, and stickers." />
        <link rel="canonical" href={`${window.location.origin}/shop`} />
      </Helmet>
      
      {/* Header */}
      <header className="glass-card border-b border-border/30 sticky top-0 z-40 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/" className="floating">
                <img 
                  src="/lovable-uploads/12c04e49-1f4c-4ed1-b840-514c07b83c24.png" 
                  alt="Spider League Logo" 
                  className="h-10 sm:h-14 w-auto flex-shrink-0 drop-shadow-lg hover:scale-105 transition-transform cursor-pointer"
                />
              </Link>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                  Spider League Shop
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground font-medium">
                  Official merchandise and gear 🕷️🛍️
                </p>
              </div>
            </div>
            
            <Button variant="ghost" asChild className="flex items-center gap-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Home</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Coming Soon Banner */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-primary/10 to-primary-glow/10 border-primary/20">
            <CardContent className="py-6">
              <div className="text-center">
                <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                  Coming Soon! 🚧
                </h2>
                <p className="text-muted-foreground">
                  Our Spider League merchandise store is currently under construction. 
                  Stay tuned for awesome gear featuring the official Spider League logo!
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="transition-all"
            >
              {category.name}
            </Button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square relative bg-muted">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTAwTDI1MCAyMDBIMTUwTDIwMCAxMDBaIiBmaWxsPSIjOUNBM0FGIi8+CjwvZ3N2Zz4=";
                  }}
                />
                <Badge 
                  className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
                  variant="secondary"
                >
                  ${product.price}
                </Badge>
              </div>
              
              <CardHeader>
                <CardTitle className="text-lg">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <Button 
                  onClick={() => handleAddToCart(product)}
                  className="w-full flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart - ${product.price}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

      </main>
    </div>
  );
};

export default Shop;