# Order To-Do App - AI Florist Edition

A comprehensive order management system with integrated AI-powered florist capabilities, built with React, TypeScript, and Cloudflare Workers.

## 🎉 Version 1.4.0 - AI Florist Integration

### ✨ New AI Features
- **🤖 AI Florist Chat**: Real-time conversation with OpenAI GPT-3.5-turbo
- **🎨 DALL-E Image Generation**: AI-powered bouquet design generation
- **⭐ Rating System**: Rate and provide feedback on generated designs
- **📊 Training Data Manager**: Comprehensive AI training analytics
- **💰 Cost Tracking**: Monitor AI generation expenses

### 🔧 Technical Enhancements
- **Database Schema**: Enhanced with AI-generated designs tracking
- **API Integration**: Full OpenAI API integration for chat and image generation
- **Real-time Analytics**: Live tracking of AI usage and performance
- **Multi-tenant Support**: Isolated AI training data per tenant

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Cloudflare account
- OpenAI API key

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd Order-To-Do-App

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Deployment
```bash
# Build and deploy to Cloudflare Workers
npm run build
npx wrangler deploy
```

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Radix UI** for accessible components

### Backend
- **Cloudflare Workers** for serverless backend
- **D1 Database** for data persistence
- **OpenAI API** for AI capabilities

### AI Integration
- **GPT-3.5-turbo** for intelligent chat responses
- **DALL-E 3** for bouquet image generation
- **Training Data Management** for continuous AI improvement

## 📁 Project Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── AIFlorist.tsx    # AI Florist chat interface
│   │   ├── AITrainingManager.tsx  # AI training data management
│   │   └── ui/              # Reusable UI components
│   ├── services/            # API and service layer
│   │   ├── api.ts           # API client functions
│   │   ├── openaiService.ts # OpenAI integration
│   │   └── aiTrainingService.ts # AI training management
│   └── types/               # TypeScript type definitions
├── worker/                  # Cloudflare Workers backend
│   └── index.ts            # Main worker file
├── migrations/             # Database migrations
└── docs/                   # Documentation
```

## 🎯 Key Features

### Order Management
- **Multi-tenant Architecture**: Isolated data per business
- **Shopify Integration**: Sync orders and products
- **Order Processing**: Status tracking and workflow management
- **Customer Management**: Customer data and order history

### AI Florist
- **Intelligent Chat**: Context-aware conversations about floral needs
- **Design Generation**: AI-powered bouquet visualization
- **Rating System**: Collect feedback for AI improvement
- **Training Analytics**: Monitor AI performance and usage

### Analytics & Reporting
- **Business Metrics**: Sales, orders, and performance tracking
- **AI Analytics**: Generation success rates and cost analysis
- **Customer Insights**: Behavior patterns and preferences
- **Real-time Updates**: Live data synchronization

## 🔧 Configuration

### Environment Variables
```env
# Cloudflare
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Database
DATABASE_URL=your_database_url

# JWT
JWT_SECRET=your_jwt_secret
```

### AI Configuration
- Configure OpenAI API key in tenant settings
- Set up AI model preferences (DALL-E 3, GPT-3.5-turbo)
- Define style templates and prompt patterns
- Configure cost limits and usage quotas

## 📊 Database Schema

### Core Tables
- `tenants` - Multi-tenant business isolation
- `tenant_users` - User management per tenant
- `tenant_orders` - Order data and processing
- `saved_products` - Product catalog management

### AI Tables
- `ai_generated_designs` - Generated bouquet designs
- `ai_training_data` - Training examples and feedback
- `ai_style_templates` - Predefined style configurations
- `ai_usage_analytics` - Usage tracking and cost analysis

## 🚀 API Endpoints

### AI Endpoints
- `POST /api/ai/chat` - AI Florist conversation
- `POST /api/ai/generate-bouquet-image` - Generate bouquet designs
- `GET /api/tenants/:tenantId/ai/generated-designs` - List designs
- `PUT /api/tenants/:tenantId/ai/generated-designs/:id` - Rate designs

### Management Endpoints
- `GET /api/tenants/:tenantId/ai/training-data/stats` - Training analytics
- `GET /api/tenants/:tenantId/ai/style-templates` - Style templates
- `GET /api/tenants/:tenantId/ai/model-configs` - AI model configurations

## 🔒 Security

- **JWT Authentication**: Secure user sessions
- **Tenant Isolation**: Data separation between businesses
- **API Rate Limiting**: Prevent abuse and control costs
- **Input Validation**: Sanitize all user inputs

## 📈 Performance

- **Serverless Architecture**: Auto-scaling with Cloudflare Workers
- **Edge Computing**: Global CDN for fast response times
- **Database Optimization**: Indexed queries for quick data access
- **Caching**: Intelligent caching for frequently accessed data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the [documentation](docs/)
- Review the [changelog](docs/CHANGELOG.md)
- Open an issue on GitHub

## 🎉 Acknowledgments

- **OpenAI** for AI capabilities
- **Cloudflare** for serverless infrastructure
- **React Team** for the amazing framework
- **Vite** for the fast build tool 