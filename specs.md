# **Personal Finance App - Subscription Tracker**
## **Comprehensive System Specifications**

---

## **📋 1. System Overview**

### **1.1 Purpose & Scope**
A self-hosted personal finance application focused exclusively on subscription management through Gmail integration. The system enables users to connect multiple Gmail accounts using individual OAuth credentials, automatically extract subscription information from emails using AI, and manage their recurring expenses through a modern web interface.

### **1.2 Core Objectives**
- **Multi-Account Gmail Integration**: Support unlimited Gmail accounts per user with individual OAuth configurations
- **AI-Powered Subscription Detection**: Automatically identify and extract subscription details from email content
- **Self-Hosted Deployment**: Complete control over data with no external dependencies for core functionality
- **Subscription Lifecycle Management**: Track, analyze, and manage subscription services across all connected accounts

### **1.3 Technical Stack Decision**
- **Frontend**: Next.js with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL 
- **AI Integration**: MCP (Model Context Protocol) with Streamable HTTPS
- **Authentication**: JWT-based with bcrypt password hashing
- **Email Processing**: Gmail API with OAuth 2.0 per account
- **Deployment**: Docker containerization for self-hosting

---

## **🏗️ 2. System Architecture**

### **2.1 High-Level Architecture Diagram**

```mermaid
graph TB
    subgraph "User Layer"
        U[User Browser]
    end

    subgraph "Frontend Layer"
        FE[Next.js Frontend]
        FE --> |API Calls| BE
    end

    subgraph "Backend Layer"
        BE[Express.js Server]
        MCP[MCP Server<br/>Streamable HTTPS]
        BE --> |AI Tools| MCP
    end

    subgraph "Data Layer"
        DB[(PostgreSQL<br/>Database)]
        Q[Processing Queue<br/>Redis/Memory]
        BE --> DB
        BE --> Q
    end

    subgraph "External Services"
        GMAIL[Gmail API]
        AI[Claude/AI Services]
        BE --> |OAuth Flow| GMAIL
        MCP --> |AI Requests| AI
    end

    U --> FE
    GMAIL --> |Email Data| BE
```

### **2.2 System Components Architecture**

#### **2.2.1 Frontend Architecture**
```mermaid
graph TD
    subgraph "Next.js Frontend"
        UI[UI Components]
        PAGES[Pages/Routes]
        SERVICES[API Services]
        STORE[State Management]
        AUTH[Auth Context]
        
        UI --> STORE
        PAGES --> UI
        PAGES --> SERVICES
        SERVICES --> AUTH
        STORE --> AUTH
    end
    
    subgraph "Component Hierarchy"
        LAYOUT[App Layout]
        DASHBOARD[Dashboard]
        OAUTH[OAuth Setup]
        ACCOUNTS[Account Management]
        SUBS[Subscription View]
        
        LAYOUT --> DASHBOARD
        LAYOUT --> OAUTH
        LAYOUT --> ACCOUNTS
        LAYOUT --> SUBS
    end
```

#### **2.2.2 Backend Architecture**
```mermaid
graph TD
    subgraph "Express.js Backend"
        ROUTES[Route Handlers]
        MIDDLEWARE[Middleware Layer]
        SERVICES[Business Logic]
        MODELS[Data Models]
        UTILS[Utilities]
        
        ROUTES --> MIDDLEWARE
        MIDDLEWARE --> SERVICES
        SERVICES --> MODELS
        SERVICES --> UTILS
    end
    
    subgraph "Core Services"
        AUTH_SVC[Authentication Service]
        OAUTH_SVC[OAuth Management Service]
        GMAIL_SVC[Gmail Integration Service]
        EMAIL_PROC[Email Processing Service]
        SUB_SVC[Subscription Service]
        MCP_SVC[MCP Integration Service]
    end
```

---

## **🔐 3. Authentication & Authorization Architecture**

### **3.1 User Authentication Flow**

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database

    U->>FE: Register/Login Request
    FE->>BE: POST /auth/register or /auth/login
    BE->>DB: Validate/Create User
    DB-->>BE: User Data
    BE->>BE: Generate JWT Token
    BE-->>FE: JWT + User Info
    FE->>FE: Store JWT in HTTP-only Cookie
    FE-->>U: Redirect to Dashboard
```

### **3.2 Authentication Components**

#### **3.2.1 User Registration System**
- **Email Validation**: Unique email constraint with format validation
- **Password Security**: bcrypt hashing with minimum complexity requirements
- **Account Initialization**: Create default categories and user preferences
- **Welcome Flow**: Guide user to OAuth setup immediately after registration

#### **3.2.2 Session Management**
- **JWT Strategy**: Stateless authentication with HTTP-only cookies
- **Token Expiration**: 7-day expiration with refresh token mechanism
- **Security Headers**: CSRF protection and secure cookie settings
- **Session Persistence**: Optional "Remember Me" functionality

---

## **🔑 4. OAuth Integration Architecture**

### **4.1 Per-Account OAuth Strategy**

The system implements a sophisticated OAuth management system where each Gmail account requires its own set of OAuth credentials, similar to n8n's approach. This design enables:

- **Complete User Control**: Users provide their own Google Cloud Project credentials
- **Unlimited Accounts**: No restrictions on number of connected Gmail accounts
- **Data Sovereignty**: No shared OAuth applications that could be rate-limited or suspended
- **Compliance**: Users maintain control over their own API quotas and usage

### **4.2 OAuth Flow Architecture**

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant GC as Google Cloud
    participant GA as Gmail API
    participant DB as Database

    Note over U,DB: Phase 1: OAuth Credential Setup
    U->>FE: Navigate to "Add Account"
    FE-->>U: Show Google Cloud Setup Instructions
    U->>GC: Create Project & OAuth Credentials
    GC-->>U: Client ID, Secret, Redirect URI
    U->>FE: Enter OAuth Credentials
    FE->>BE: POST /oauth/credentials
    BE->>DB: Store Encrypted Credentials
    
    Note over U,DB: Phase 2: Account Connection
    U->>FE: Click "Connect Google Account"
    FE->>BE: GET /oauth/{id}/auth-url
    BE->>BE: Generate OAuth URL with stored credentials
    BE-->>FE: OAuth Authorization URL
    FE-->>U: Redirect to Google Authorization
    U->>GC: Grant Permissions
    GC-->>FE: Authorization Code (via redirect)
    FE->>BE: POST /oauth/{id}/callback
    BE->>GC: Exchange Code for Tokens
    GC-->>BE: Access & Refresh Tokens
    BE->>GA: Get User Profile
    GA-->>BE: Gmail Account Info
    BE->>DB: Store Account + Encrypted Tokens
    BE-->>FE: Connection Success
    
    Note over U,DB: Phase 3: Initial Email Sync
    BE->>BE: Queue Initial Sync Job
    BE->>GA: Fetch Email List
    GA-->>BE: Email Metadata
    BE->>BE: Queue Email Processing
```

### **4.3 OAuth Credential Management**

#### **4.3.1 Storage Strategy**
- **Encryption at Rest**: All OAuth secrets encrypted using AES-256
- **Key Management**: Encryption keys stored separately from database
- **Access Control**: Credentials only accessible to owning user
- **Audit Trail**: Track credential creation, usage, and modification

#### **4.3.2 Token Lifecycle Management**
- **Automatic Refresh**: Proactive token refresh before expiration
- **Error Handling**: Graceful handling of revoked or expired tokens
- **Retry Logic**: Exponential backoff for failed API requests
- **User Notification**: Alert users when manual reauthorization needed

---

## **📧 5. Gmail Integration Architecture**

### **5.1 Email Synchronization Strategy**

The system implements a comprehensive email synchronization strategy that handles both historical data and real-time updates efficiently.

#### **5.1.1 Initial Synchronization Process**
```mermaid
graph TD
    START[Account Connected] --> HIST[Historical Sync Phase]
    HIST --> BATCH[Batch Email Retrieval]
    BATCH --> QUEUE[Queue for Processing]
    QUEUE --> PROCESS[AI Processing]
    PROCESS --> STORE[Store Results]
    STORE --> MONITOR[Monitor Progress]
    MONITOR --> |Complete| REALTIME[Real-time Sync Phase]
    MONITOR --> |Continuing| BATCH
    REALTIME --> WEBHOOK[Gmail Push Notifications]
    WEBHOOK --> INCREMENTAL[Incremental Updates]
```

#### **5.1.2 Synchronization Components**

**Historical Data Sync**:
- **Batch Processing**: Retrieve emails in configurable batch sizes (default: 100 emails)
- **Date Range Filtering**: Configurable historical depth (default: 2 years)
- **Progress Tracking**: Real-time progress updates for user feedback
- **Resume Capability**: Handle interruptions and resume from last processed email
- **Rate Limiting**: Respect Gmail API quotas with intelligent throttling

**Real-time Sync**:
- **Push Notifications**: Gmail push notifications for immediate updates
- **Polling Fallback**: Periodic polling as backup for missed notifications
- **Incremental Processing**: Process only new emails since last sync
- **Duplicate Detection**: Prevent processing same email multiple times

### **5.2 Email Processing Pipeline**

#### **5.2.1 Processing Flow Architecture**
```mermaid
graph TD
    subgraph "Email Processing Pipeline"
        RECEIVE[Receive Email] --> VALIDATE[Validate Email Data]
        VALIDATE --> EXTRACT[Extract Content]
        EXTRACT --> AI[AI Processing via MCP]
        AI --> CONFIDENCE[Evaluate Confidence]
        CONFIDENCE --> |High Confidence| STORE_SUB[Store Subscription]
        CONFIDENCE --> |Low Confidence| STORE_EMAIL[Store Email Only]
        CONFIDENCE --> |Manual Review| QUEUE_REVIEW[Queue for Review]
        STORE_SUB --> NOTIFY[User Notification]
        STORE_EMAIL --> COMPLETE[Mark Complete]
        QUEUE_REVIEW --> COMPLETE
    end
    
    subgraph "AI Processing Detail"
        AI --> SUBSCRIPTION[Subscription Detection]
        AI --> EXTRACTION[Data Extraction]
        AI --> VALIDATION[Data Validation]
    end
```

#### **5.2.2 Processing Components**

**Email Content Extraction**:
- **Multi-format Support**: Handle both HTML and plain text emails
- **Content Cleaning**: Remove signatures, headers, and irrelevant content
- **Language Detection**: Identify email language for better AI processing
- **Metadata Extraction**: Sender information, dates, and email classification

**AI Processing Integration**:
- **MCP Tool Invocation**: Call subscription extraction tools via MCP server
- **Context Building**: Provide rich context to AI including sender patterns
- **Confidence Scoring**: Evaluate reliability of AI extraction results
- **Fallback Strategies**: Handle AI processing failures gracefully

---

## **🤖 6. MCP (Model Context Protocol) Architecture**

### **6.1 MCP Server Design**

The MCP server operates as a dedicated service providing AI-powered tools for email analysis and subscription extraction. It uses the Streamable HTTPS transport protocol for real-time communication and progress updates.

#### **6.1.1 MCP Server Architecture**
```mermaid
graph TD
    subgraph "MCP Server"
        TRANSPORT[Streamable HTTPS Transport]
        TOOLS[Tool Registry]
        SESSION[Session Management]
        PROGRESS[Progress Tracking]
        
        TRANSPORT --> SESSION
        SESSION --> TOOLS
        TOOLS --> PROGRESS
    end
    
    subgraph "AI Tools"
        SUB_EXTRACT[Subscription Extractor]
        EMAIL_ANALYZER[Email Analyzer]
        PATTERN_DETECT[Pattern Detection]
        DATA_VALIDATE[Data Validator]
        
        TOOLS --> SUB_EXTRACT
        TOOLS --> EMAIL_ANALYZER
        TOOLS --> PATTERN_DETECT
        TOOLS --> DATA_VALIDATE
    end
    
    subgraph "External AI"
        CLAUDE[Claude API]
        
        SUB_EXTRACT --> CLAUDE
        EMAIL_ANALYZER --> CLAUDE
        PATTERN_DETECT --> CLAUDE
    end
```

#### **6.1.2 Tool Implementation Strategy**

**Subscription Extraction Tool**:
- **Input Processing**: Clean and structure email content for AI analysis
- **Prompt Engineering**: Sophisticated prompts for accurate subscription detection
- **Output Standardization**: Consistent JSON schema for extracted data
- **Confidence Scoring**: Provide reliability metrics for extracted information

**Pattern Detection Tool**:
- **Sender Analysis**: Identify patterns in subscription-related senders
- **Content Analysis**: Detect recurring billing notifications and patterns
- **Learning Capability**: Improve detection based on user feedback
- **Custom Rules**: Allow users to define custom subscription patterns

### **6.2 MCP Communication Protocol**

#### **6.2.1 Request/Response Flow**
```mermaid
sequenceDiagram
    participant EP as Email Processor
    participant MCP as MCP Server
    participant AI as Claude API

    EP->>MCP: POST /mcp (extract-subscription)
    MCP->>MCP: Initialize Session
    MCP-->>EP: Session ID + Processing Started
    MCP->>AI: Analyze Email Content
    AI-->>MCP: AI Response
    MCP->>MCP: Process & Validate Response
    MCP-->>EP: SSE Progress Update (50%)
    MCP->>AI: Additional Analysis (if needed)
    AI-->>MCP: Refined Results
    MCP-->>EP: SSE Progress Update (100%)
    MCP-->>EP: Final Results
```

#### **6.2.2 Session Management**
- **Session Persistence**: Maintain state across multiple tool calls
- **Progress Tracking**: Real-time progress updates via Server-Sent Events
- **Error Recovery**: Handle network interruptions and AI service failures
- **Resource Management**: Automatic cleanup of completed sessions

---

## **💾 7. Data Architecture**

### **7.1 Database Design Philosophy**

The database design follows principles of data sovereignty, audit trails, and extensibility while maintaining performance for real-time operations.

#### **7.1.1 Data Model Relationships**
```mermaid
erDiagram
    USER {
        uuid id PK
        string email UK
        string password_hash
        timestamp created_at
        timestamp updated_at
    }
    
    OAUTH_CREDENTIAL {
        uuid id PK
        uuid user_id FK
        string credential_name UK
        string client_id
        string client_secret_encrypted
        string redirect_uri
        timestamp created_at
    }
    
    GMAIL_ACCOUNT {
        uuid id PK
        uuid user_id FK
        uuid oauth_credential_id FK
        string email UK
        string access_token_encrypted
        string refresh_token_encrypted
        timestamp token_expiry
        boolean is_active
        timestamp last_sync
        string sync_status
        integer total_emails
        integer processed_emails
    }
    
    EMAIL {
        uuid id PK
        uuid gmail_account_id FK
        string gmail_message_id UK
        string subject
        string sender_email
        text body_text
        text body_html
        timestamp received_at
        boolean is_subscription
        decimal subscription_confidence
        jsonb extracted_data
        timestamp processed_at
    }
    
    SUBSCRIPTION {
        uuid id PK
        uuid user_id FK
        uuid email_id FK
        string service_name
        decimal amount
        string currency
        string billing_cycle
        date next_billing_date
        string status
        decimal confidence_score
        boolean user_verified
        timestamp first_detected
        timestamp last_updated
    }
    
    CATEGORY {
        uuid id PK
        uuid user_id FK
        string name UK
        string color
        string icon
        boolean is_system
        timestamp created_at
    }
    
    USER ||--o{ OAUTH_CREDENTIAL : "owns"
    USER ||--o{ GMAIL_ACCOUNT : "connects"
    USER ||--o{ SUBSCRIPTION : "has"
    USER ||--o{ CATEGORY : "defines"
    OAUTH_CREDENTIAL ||--o{ GMAIL_ACCOUNT : "enables"
    GMAIL_ACCOUNT ||--o{ EMAIL : "contains"
    EMAIL ||--o| SUBSCRIPTION : "generates"
```

### **7.2 Data Flow Architecture**

#### **7.2.1 Email Processing Data Flow**
```mermaid
graph TD
    subgraph "Data Ingestion"
        GMAIL[Gmail API] --> RAW[Raw Email Data]
        RAW --> NORMALIZE[Data Normalization]
        NORMALIZE --> QUEUE[Processing Queue]
    end
    
    subgraph "Processing Pipeline"
        QUEUE --> EXTRACT[Content Extraction]
        EXTRACT --> AI_PROC[AI Processing]
        AI_PROC --> VALIDATION[Data Validation]
        VALIDATION --> STORAGE[Data Storage]
    end
    
    subgraph "Data Storage"
        STORAGE --> EMAIL_TBL[(Email Table)]
        STORAGE --> SUB_TBL[(Subscription Table)]
        EMAIL_TBL --> ANALYTICS[Analytics Views]
        SUB_TBL --> ANALYTICS
    end
    
    subgraph "Data Consumption"
        ANALYTICS --> DASHBOARD[Dashboard API]
        ANALYTICS --> REPORTS[Reports API]
        DASHBOARD --> FRONTEND[Frontend Display]
        REPORTS --> FRONTEND
    end
```

### **7.3 Data Security & Privacy**

#### **7.3.1 Security Layers**
- **Encryption at Rest**: All sensitive data encrypted using industry-standard algorithms
- **Access Control**: Role-based access with user isolation
- **Audit Logging**: Comprehensive audit trail for all data operations
- **Data Retention**: Configurable retention policies for compliance
- **Backup Strategy**: Automated encrypted backups with point-in-time recovery

#### **7.3.2 Privacy Compliance**
- **Data Minimization**: Store only necessary email content and metadata
- **User Control**: Complete user control over data deletion and export
- **Consent Management**: Clear consent for data processing activities
- **Data Portability**: Export functionality for user data in standard formats

---

## **📱 8. Frontend Architecture**

### **8.1 User Interface Design System**

#### **8.1.1 Design Principles**
- **Dark Mode First**: Optimized for dark environments with green accent color
- **Mobile Responsive**: Progressive enhancement from mobile to desktop
- **Accessibility**: WCAG 2.1 AA compliance with keyboard navigation
- **Performance**: Optimized loading with skeleton screens and lazy loading

#### **8.1.2 Component Architecture**
```mermaid
graph TD
    subgraph "Layout Components"
        SHELL[App Shell]
        NAV[Navigation]
        SIDEBAR[Sidebar]
        HEADER[Header]
        
        SHELL --> NAV
        SHELL --> SIDEBAR  
        SHELL --> HEADER
    end
    
    subgraph "Feature Components"
        AUTH[Authentication Forms]
        OAUTH[OAuth Setup Wizard]
        DASHBOARD[Dashboard Views]
        SETTINGS[Settings Panels]
        
        SHELL --> AUTH
        SHELL --> OAUTH
        SHELL --> DASHBOARD
        SHELL --> SETTINGS
    end
    
    subgraph "Shared Components"
        FORMS[Form Components]
        MODALS[Modal System]
        TABLES[Data Tables]
        CHARTS[Visualization Charts]
        
        OAUTH --> FORMS
        DASHBOARD --> TABLES
        DASHBOARD --> CHARTS
        SETTINGS --> FORMS
    end
```

### **8.2 State Management Architecture**

#### **8.2.1 State Flow Design**
```mermaid
graph TD
    subgraph "Client State"
        UI[UI Components]
        LOCAL[Local State]
        CONTEXT[React Context]
        
        UI --> LOCAL
        LOCAL --> CONTEXT
    end
    
    subgraph "Server State"
        API[API Calls]
        CACHE[Response Cache]
        SYNC[Background Sync]
        
        CONTEXT --> API
        API --> CACHE
        CACHE --> SYNC
    end
    
    subgraph "Persistent State"
        STORAGE[Local Storage]
        COOKIES[HTTP Cookies]
        
        CONTEXT --> STORAGE
        CONTEXT --> COOKIES
    end
```

### **8.3 User Experience Flow**

#### **8.3.1 Onboarding Sequence**
```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend

    U->>FE: Access Application
    FE-->>U: Show Landing/Register Page
    U->>FE: Complete Registration
    FE->>BE: Create Account
    BE-->>FE: Account Created
    FE-->>U: Show Empty Dashboard
    U->>FE: Click "Add Gmail Account"
    FE-->>U: Show OAuth Setup Instructions
    U->>FE: Enter OAuth Credentials
    FE->>BE: Save OAuth Credentials
    BE-->>FE: Credentials Saved
    FE-->>U: Show "Connect Account" Button
    U->>FE: Connect Account
    Note over FE,BE: OAuth Flow (see OAuth Architecture)
    FE-->>U: Show Sync Progress
    Note over FE,BE: Email Processing (background)
    FE-->>U: Show Populated Dashboard
```

---

## **🔄 9. System Integration & Communication**

### **9.1 Inter-Service Communication**

#### **9.1.1 Communication Patterns**
```mermaid
graph TD
    subgraph "Synchronous Communication"
        HTTP[HTTP REST APIs]
        AUTH[Authentication Middleware]
        VALIDATION[Request Validation]
        
        HTTP --> AUTH
        AUTH --> VALIDATION
    end
    
    subgraph "Asynchronous Communication"
        QUEUE[Processing Queue]
        EVENTS[Event System]
        JOBS[Background Jobs]
        
        QUEUE --> JOBS
        JOBS --> EVENTS
    end
    
    subgraph "Real-time Communication"
        SSE[Server-Sent Events]
        WEBSOCKETS[WebSocket Connections]
        NOTIFICATIONS[Push Notifications]
        
        SSE --> NOTIFICATIONS
        WEBSOCKETS --> NOTIFICATIONS
    end
```

### **9.2 External Service Integration**

#### **9.2.1 Gmail API Integration Strategy**
- **Rate Limiting**: Intelligent throttling based on quota usage and user limits
- **Error Handling**: Comprehensive error recovery for network and API failures
- **Caching Strategy**: Cache email metadata to reduce API calls
- **Bulk Operations**: Batch API requests for improved efficiency

#### **9.2.2 AI Service Integration**
- **Model Selection**: Configurable AI models based on task complexity
- **Fallback Strategies**: Multiple AI providers for redundancy
- **Cost Optimization**: Request caching and result reuse
- **Quality Assurance**: Confidence scoring and human review workflows

---

## **🚀 10. Deployment Architecture**

### **10.1 Self-Hosting Strategy**

#### **10.1.1 Containerization Architecture**
```mermaid
graph TD
    subgraph "Docker Environment"
        FRONTEND[Frontend Container<br/>Next.js + Nginx]
        BACKEND[Backend Container<br/>Express.js + Node.js]
        MCP[MCP Server Container<br/>TypeScript + Node.js]
        DB[Database Container<br/>PostgreSQL]
        REDIS[Cache Container<br/>Redis]
        PROXY[Reverse Proxy<br/>Nginx/Traefik]
        
        PROXY --> FRONTEND
        PROXY --> BACKEND
        PROXY --> MCP
        BACKEND --> DB
        BACKEND --> REDIS
        MCP --> REDIS
    end
    
    subgraph "Volumes"
        DB_VOL[Database Volume]
        UPLOAD_VOL[Upload Volume]
        LOG_VOL[Log Volume]
        
        DB --> DB_VOL
        BACKEND --> UPLOAD_VOL
        BACKEND --> LOG_VOL
    end
```

### **10.2 Configuration Management**

#### **10.2.1 Environment Configuration**
- **Environment Variables**: All configuration via environment variables
- **Secrets Management**: Secure handling of API keys and database credentials  
- **Feature Flags**: Runtime feature toggles for gradual rollouts
- **Health Checks**: Comprehensive health monitoring for all services

#### **10.2.2 Monitoring & Logging**
- **Application Metrics**: Performance monitoring with custom dashboards
- **Error Tracking**: Centralized error logging and alerting
- **Audit Trails**: Complete audit logs for security and compliance
- **Resource Monitoring**: CPU, memory, and disk usage tracking

---

## **🔧 11. Development & Maintenance**

### **11.1 Development Workflow**

#### **11.1.1 Code Organization**
- **Monorepo Structure**: Single repository with clear module boundaries
- **Shared Libraries**: Common utilities and types across frontend and backend
- **Type Safety**: End-to-end TypeScript for compile-time error detection
- **Testing Strategy**: Unit, integration, and end-to-end testing frameworks

### **11.2 Quality Assurance**

#### **11.2.1 Testing Architecture**
```mermaid
graph TD
    subgraph "Testing Layers"
        UNIT[Unit Tests<br/>Jest + Testing Library]
        INTEGRATION[Integration Tests<br/>Supertest + Test DB]
        E2E[End-to-End Tests<br/>Playwright]
        
        UNIT --> INTEGRATION
        INTEGRATION --> E2E
    end
    
    subgraph "Quality Gates"
        LINT[ESLint + Prettier]
        TYPE[TypeScript Check]
        SECURITY[Security Audit]
        PERFORMANCE[Performance Tests]
        
        LINT --> TYPE
        TYPE --> SECURITY
        SECURITY --> PERFORMANCE
    end
```

### **11.3 Maintenance Strategy**

#### **11.3.1 Update Management**
- **Dependency Updates**: Automated security updates with manual review for major versions
- **Database Migrations**: Versioned schema migrations with rollback capabilities  
- **Configuration Updates**: Hot-reloading for non-critical configuration changes
- **Feature Deployment**: Blue-green deployment strategy for zero-downtime updates
