# TechMart Online: Enterprise E-Commerce Modernization Project

An academic architectural blueprint and production-ready implementation of a modernized e-commerce platform built on the **Jakarta EE 10** platform, leveraging **Payara Server 6**, and backed by **PostgreSQL 15+**. This project demonstrates enterprise design patterns including distributed session management, JTA transactions, asynchronous processing, message-driven workflows, and real-time inventory synchronization.

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Session Bean Design & Concurrency](#2-session-bean-design--concurrency)
3. [JNDI and Dependency Injection (CDI)](#3-jndi-and-dependency-injection-cdi)
4. [Asynchronous Processing & Timeout Recovery](#4-asynchronous-processing--timeout-recovery)
5. [JMS & Message-Driven Beans (MDBs)](#5-jms--message-driven-beans-mdbs)
6. [Database Design & Connection Pooling](#6-database-design--connection-pooling)
7. [Performance Monitoring & Auditing](#7-performance-monitoring--auditing)
8. [Testing & Quality Assurance](#8-testing--quality-assurance)
9. [Project Structure Layout](#9-project-structure-layout)
10. [Non-Functional Requirements (NFRs)](#10-non-functional-requirements-nfrs)
11. [Deployment & Operations Guide](#11-deployment--operations-guide)

---

## 1. System Architecture

TechMart Online is structured around a classic **Multi-Tiered Layered Architecture** optimized for containerized cloud deployment and high-throughput transaction isolation.

### Layered Architecture Diagram

```mermaid
graph TD
    subgraph Presentation Layer [1. Presentation Layer JAX-RS REST]
        PR[ProductResource]
        CR[CartResource]
        OR[OrderResource]
    end

    subgraph Business Layer [2. Business Layer EJBs & CDI]
        PS[ProductService Stateless]
        OS[OrderService Stateless]
        SC[ShoppingCartBean Stateful]
        IM[InventoryManager Singleton]
        SCM[SystemConfigurationManager Singleton]
    end

    subgraph Messaging Layer [3. Messaging Layer JMS OpenMQ]
        CF[TechMartConnectionFactory]
        OPQ[OrderProcessingQueue]
        IUQ[InventoryUpdateQueue]
        CNT[CustomerNotificationTopic]
    end

    subgraph Asynchronous Consumers [4. Message Driven Beans MDBs]
        OPMDB[OrderProcessingMDB]
        IMDB[InventoryMDB]
        NMDB[NotificationMDB]
    end

    subgraph Persistence Layer [5. Persistence Layer JPA / Hibernate]
        PU[(TechMartPU)]
        DB[(PostgreSQL Database)]
    end

    subgraph External services [6. External Services Integration]
        SMTP[SMTP Mail Server]
        PayGateway[Payment Gateway API]
    end

    %% Client Interactions
    Client[HTTP Client / Frontend] -->|REST JSON| Presentation Layer
    
    %% Presentation to Business
    PR --> PS
    CR --> SC
    OR --> OS
    OR --> SC
    
    %% Business to Persistence/Messaging
    OS -->|JTA CMT| IM
    OS -->|JMS Message| OPQ
    OS -->|JMS Publish| CNT
    OS -->|JAX-RS Client / Async Future| PayGateway
    
    %% JMS to MDBs
    OPQ --> OPMDB
    IUQ --> IMDB
    CNT --> NMDB
    
    %% MDBs to Persistence/External
    OPMDB -->|State Update| PU
    OPMDB -->|Queue Message| IUQ
    IMDB -->|Read/Alert| PU
    NMDB -->|Persist Audit Log| PU
    NMDB -->|SMTP API| SMTP
    
    %% JPA to Database
    PS --> PU
    IM --> PU
    PU --> DB
```

### Layer Interaction Specifications
1. **Presentation Layer**: Handles incoming HTTP REST calls. It is stateless (except cart session tracking) and processes payload mappings via JAX-RS and JSON-B.
2. **Business Layer**: Enforces the domain logic. EJBs coordinate transaction boundaries. Stateless EJBs handle scalable queries; Stateful EJBs handle user conversational session states; Singletons manage shared configurations and thread-safe operations.
3. **Messaging Layer**: Implements decoupled, non-blocking communications. OpenMQ (embedded in Payara) guarantees reliable transmission under high load.
4. **Persistence Layer**: Employs Object-Relational Mapping (ORM) via EclipseLink (JPA 3.1) executing queries over PostgreSQL.
5. **External Services**: Integrated asynchronously to prevent slow third-party latency (e.g., SMTP or credit card processing) from blocking the core transaction.

---

## 2. Session Bean Design & Concurrency

Enterprise JavaBeans (EJB 3.2 / Jakarta Enterprise Beans 4.0) provide out-of-the-box system utilities including declarative transactions, security, pooling, and concurrency controls.

### 2.1 EJB Classification in TechMart Online

| Bean Name | Classification | Concurrency Control | Purpose |
| :--- | :--- | :--- | :--- |
| `ProductService` | **Stateless (SLSB)** | Container Managed (Pooled) | Lightweight, highly scalable read/write operations for catalog browsing. |
| `OrderService` | **Stateless (SLSB)** | Container Managed (Pooled) | Orchestrates checkout transactions. Houses `@Asynchronous` helper threads. |
| `ShoppingCartBean` | **Stateful (SFSB)** | Client-Serialized Session | Holds user checkout items. Implements passivation/activation to save JVM memory. |
| `InventoryManager` | **Singleton** | Container Managed Concurrency (CMC) | Handles thread-safe, real-time inventory adjustments with WRITE lock constraints. |
| `SystemConfigurationManager` | **Singleton** | Container Managed Concurrency (CMC) | Loads config properties eagerly at startup (`@Startup`). High-throughput READ locks. |

### 2.2 Stateful Lifecycle and Memory Optimization (Passivation/Activation)
Stateful beans like [ShoppingCartBean](file:///f:/Techmart/src/main/java/com/techmart/service/ShoppingCartBean.java) hold conversational client states. To prevent JVM OutOfMemory errors under a 10,000+ concurrent user load, the container passivates idle SFSBs.

```
       [Client Call]
            │
            ▼
┌──────────────────────┐
│  State: Active       │  ◄── PostActivate (Deserialized from disk)
│  (In JVM RAM)        │
└──────────┬───────────┘
           │  Passivation triggered by Container (Memory low / Idle timeout)
           ▼
┌──────────────────────┐
│  State: Passivated   │  ──► PrePassivate (Serialized to secondary storage)
│  (Serialized on Disk)│
└──────────────────────┘
```

- **Passivation (`@PrePassivate`)**: The container serializes the bean's state to disk and releases JVM memory. We must close active connections (e.g., file channels, sockets) beforehand.
- **Activation (`@PostActivate`)**: When the client calls the bean again, it is deserialized. We restore resources like JNDI references or loggers.
- **Destruction (`@Remove`)**: Calling the checkout end-state destroys the SFSB instance immediately, bypassing disk write costs.

---

## 3. JNDI and Dependency Injection (CDI)

Modern Jakarta EE applications utilize both Java Naming and Directory Interface (JNDI) and Contexts and Dependency Injection (CDI) based on architectural decoupling requirements.

### 3.1 JNDI Lookup vs CDI Injection Comparison

#### JNDI Lookup (Dynamic Service Location)
- **Mechanism**: Thread-safe directory search query.
- **Code Example**:
  ```java
  InitialContext ctx = new InitialContext();
  Queue queue = (Queue) ctx.lookup("jms/queue/OrderProcessingQueue");
  ```
- **Pros**: Highly dynamic. Allows late binding and lookups of remote resources in a clustered environment.
- **Cons**: Checked exceptions (`NamingException`), boilerplate code, unit testing requires mocking JNDI directories.

#### CDI Injection (Inversion of Control)
- **Mechanism**: Typesafe dependency injection at bean construction.
- **Code Example**:
  ```java
  @Inject
  private ShoppingCartBean cart;
  ```
- **Pros**: Strongly-typed, compilation check, zero lookup boilerplate, testable using Mockito mock injections.
- **Cons**: Injection bindings are static and determined at deploy/compile time.

### 3.2 Performance Impact Analysis
- **CDI Injection** incurs a minor startup overhead as the container scans the classpath to build the dependency injection graph. However, at runtime, method calls are direct or routed via lightweight generated proxies, showing zero performance degradation.
- **JNDI lookup** introduces latency at runtime if executed repeatedly inside loops (network round-trips to LDAP or local registry).
- **Optimization Strategy**: In TechMart, resources are injected via `@Inject` or `@Resource` at the field level, caching reference proxies inside the EJB instance to eliminate runtime lookup penalties.

---

## 4. Asynchronous Processing & Timeout Recovery

To maintain high availability (99.9% uptime target) and prevent thread exhaustion, slow third-party workflows are executed concurrently using EJB `@Asynchronous` execution threads.

### 4.1 Non-Blocking Checkout Flow

When `OrderResource` receives a checkout request:
1. `OrderService.placeOrder` performs database write operations and publishes messages to the JMS queues in a JTA transaction (Fast, < 50ms).
2. It returns a `Response` to the customer immediately.
3. Simultaneously, `OrderService.processPaymentAsync` executes payment gateway connection rules on a container-managed worker thread.

### 4.2 Timeout Handling & Error Recovery Implementation
The API layer executes payment validation with an explicit timeout budget:

```java
Future<Boolean> paymentFuture = orderService.processPaymentAsync(orderId, amount);
try {
    Boolean result = paymentFuture.get(4, TimeUnit.SECONDS); // 4-Second Timeout Budget
    if (result) { return Response.ok("Payment Success"); }
} catch (TimeoutException e) {
    // Error Recovery: Inform customer that payment is pending, continue verification asynchronously
    return Response.status(Status.ACCEPTED).entity("Payment pending background verification.");
}
```

#### Error Recovery Steps:
- **Automatic Retries**: If the external payment API fails with a network exception, the `OrderService` captures the failure, waits, and performs a retry sequence.
- **Compensation Transactions**: If the payment fails permanently, the MDB initiates compensation logic: canceling the order in the database and calling `inventoryManager.restock()` to add stock quantities back.

---

## 5. JMS Architecture

Java Message Service (JMS) decouples producers and consumers, enabling horizontal scaling and spikes absorption.

```
                  ┌──────────────┐
                  │ OrderService │
                  └──────┬───────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼ (Queue Producer)                ▼ (Topic Publisher)
 ┌──────────────┐                  ┌──────────────┐
 │OrderProcQueue│                  │CustNotifTopic│
 └──────┬───────┘                  └──────┬───────┘
        │                                 ├───────────────────────┐
        ▼ (Point-to-Point)                ▼ (Pub-Sub Fan-out)     ▼ (Durable Sub)
 ┌──────────────┐                  ┌──────────────┐        ┌──────────────┐
 │OrderProcMDB  │                  │NotificationMDB│       │  AuditMDB    │
 └──────────────┘                  └──────────────┘        └──────────────┘
```

### 5.1 Queue vs Topic Architectures

#### 1. Point-to-Point (Queue): `OrderProcessingQueue` & `InventoryUpdateQueue`
- **Delivery Model**: Single-Consumer (One-to-One).
- **Behavior**: Messages are stored in the queue until a consumer processes and acknowledges them. If multiple `OrderProcessingMDB` instances are deployed, the container load-balances messages among them.
- **Reliability**: Excellent. Guaranteed delivery even if the MDB server is shut down temporarily.

#### 2. Publish-Subscribe (Topic): `CustomerNotificationTopic`
- **Delivery Model**: Multi-Consumer (One-to-Many / Fan-out).
- **Behavior**: Every active subscriber receives a copy of the message.
- **Reliability**: Configured as **Durable Subscription** in `NotificationMDB`. If the notification service is offline, Payara's JMS broker saves messages until the subscriber reconnects.

### 5.2 Reliability Considerations (Delivery Guarantees)
- **Persistent Messages**: Messages are written to database tables in Payara's file store. If the server crashes, messages are recovered upon restart.
- **Transactional Sessions**: The message is dequeued *within* the MDB's JTA transaction context. If processing fails, the transaction rolls back, and the message returns to the queue.

---

## 6. Message Driven Beans (MDBs)

MDBs act as asynchronous message consumers pooled by the Jakarta EE container.

### 6.1 MDB Lifecycles & Pool Scaling
MDB instances have no conversational state. The container manages their lifecycle similarly to Stateless session beans:

```
    [No Instance]
          │
          │  Container starts up or increases pool size
          ▼
┌──────────────────┐
│   Instantiation  │  ──► Constructor execution
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│  @PostConstruct  │  ──► Resources injected & configured
└─────────┬────────┘
          │
          ▼
┌──────────────────┐
│   Pooled / Idle  │  ◄── Message arrives: active consumption (onMessage)
└─────────┬────────┘
          │
          │  Container scales down (idle timeout) or shuts down
          ▼
┌──────────────────┐
│   @PreDestroy    │  ──► Clean up resource references
└─────────┬────────┘
          │
          ▼
    [Destroyed]
```

### 6.2 Scalability Optimizations
- **Concurrency Pooling**: Payara adjusts the consumer pool size (e.g., from 10 to 100 concurrent MDB threads) depending on the message count in the queue.
- **Non-blocking DB Operations**: MDBs execute operations using optimized query footprints, utilizing secondary indexing to prevent database bottlenecks.

---

## 7. Database Design & Connection Pooling

### 7.1 Entity Relationship Diagram (Conceptual Layout)

```
  ┌───────────┐          ┌──────────────┐          ┌──────────┐
  │   users   │1        *│    orders    │1        *│order_items│
  │  (Id, PK) ├─────────►│ (Id, PK)     ├─────────►│(Id, PK)  │
  └─────┬─────┘          │ (User_Id, FK)│          │(Order_Id,│
        │                └──────────────┘          │  FK)     │
        │1                                         │(Product_│
        │                                          │  Id, FK) │
        ▼*                                         └────┬─────┘
  ┌─────────────┐                                       │
  │notifications│                                       │
  │  (Id, PK)   │                                       │*
  │(User_Id, FK)│                                       │
  └─────────────┘          ┌──────────────┐            │1
                           │  categories  │1           ▼
                           │  (Id, PK)    │◄───────────┼──────────┐
                           └──────┬───────┘            │ products │
                                  │1                   │ (Id, PK) │
                                  │                    │(Category_│
                                  ▼*                   │  Id, FK) │
                           ┌──────────────┐            └────┬─────┘
                           │   products   │                 │1
                           │  (Id, PK)    │                 │
                           └──────────────┘                 ▼1
                                                       ┌──────────┐
                                                       │inventory │
                                                       │ (Id, PK) │
                                                       │(Product_ │
                                                       │  Id, FK) │
                                                       └──────────┘
```

### 7.2 Database Optimization & Connection Pooling Configs

To support **10,000+ concurrent users**, raw database queries and connection overhead must be optimized:

1. **Indexes**:
   - `idx_products_sku`: Speed up SKU searches on catalog views.
   - `idx_order_items_order`: Essential to prevent full table scans when rendering cart/order items.
   - Foreign key indexing prevents table locks during update operations.

2. **Connection Pooling Parameters (in `payara-resources.xml`)**:
   - `steady-pool-size = 32`: Keeps 32 connections warm in memory, eliminating connection overhead.
   - `max-pool-size = 128`: Scales up to 128 connections under spike loads.
   - `checkout-timeout-in-ms = 5000`: Fails fast if a thread cannot get a connection in 5 seconds. Prevents thread stagnation.
   - `is-connection-validation-required = true`: Validates connections prior to execution to prevent stale connection errors.

---

## 8. Testing & Quality Assurance

TechMart Online implements a comprehensive testing hierarchy, separating code logic from integration environments.

### 8.1 Testing Architecture
1. **Unit Testing (JUnit 5 + Mockito)**:
   - Validates individual class logic quickly.
   - **Target**: [ProductServiceTest](file:///f:/Techmart/src/test/java/com/techmart/service/ProductServiceTest.java) mocks the JPA entity manager and tests boundary rules without starting database engines or app servers.
2. **Integration Testing (Arquillian)**:
   - Starts an embedded or remote Jakarta EE container (e.g. Payara).
   - Generates a custom deployable archive via **ShrinkWrap**.
   - **Target**: [OrderServiceIntegrationTest](file:///f:/Techmart/src/test/java/com/techmart/service/OrderServiceIntegrationTest.java) checks JTA transactions, JPA updates, and database constraints in a real runtime context.

### 8.2 Load & Performance Testing Plan
To validate the **10,000+ concurrent user target** and **99.9% uptime**:
- **Tool**: Apache JMeter or Gatling.
- **Scenario**:
  - 15-minute ramp-up to 10,000 concurrent sessions.
  - Users execute a mix of browse products (60%), add to cart (30%), and checkout (10%).
- **Verification Metrics**:
  - Response time for catalog browsing: < 200ms.
  - Checkout complete: < 500ms (JMS asynchronous handoff).
  - Error rate: < 0.1% (99.9% availability).

---

## 9. Project Structure Layout

The standard Maven Web Archive (WAR) directory structure:

```
TechMart/
│
├── pom.xml                                    # Maven dependencies (Jakarta EE 10, JUnit, Mockito)
├── README.md                                  # Architectural layout and analysis (This document)
│
└── src/
    ├── main/
    │   ├── java/
    │   │   └── com/
    │   │       └── techmart/
    │   │           ├── domain/                # JPA Database Entities
    │   │           │   ├── User.java
    │   │           │   ├── Category.java
    │   │           │   ├── Product.java
    │   │           │   ├── Inventory.java
    │   │           │   ├── Order.java
    │   │           │   ├── OrderItem.java
    │   │           │   ├── Notification.java
    │   │           │   └── CartItem.java
    │   │           │
    │   │           ├── service/               # EJB Session Beans (Stateless, Stateful, Singleton)
    │   │           │   ├── ProductService.java
    │   │           │   ├── OrderService.java
    │   │           │   ├── ShoppingCartBean.java
    │   │           │   ├── InventoryManager.java
    │   │           │   └── SystemConfigurationManager.java
    │   │           │
    │   │           ├── messaging/             # JMS Producer & Message Driven Beans (MDBs)
    │   │           │   ├── JMSProducer.java
    │   │           │   ├── OrderProcessingMDB.java
    │   │           │   ├── InventoryMDB.java
    │   │           │   └── NotificationMDB.java
    │   │           │
    │   │           ├── monitoring/            # CDI Interceptor & Performance Metrics
    │   │           │   ├── Logged.java
    │   │           │   └── PerformanceInterceptor.java
    │   │           │
    │   │           └── rest/                  # Presentation Layer (JAX-RS Resources)
    │   │               ├── RestApplication.java
    │   │               ├── ProductResource.java
    │   │               ├── CartResource.java
    │   │               └── OrderResource.java
    │   │
    │   ├── resources/
    │   │   ├── schema.sql                     # PostgreSQL Database schema
    │   │   └── META-INF/
    │   │       ├── persistence.xml            # JPA Persistence Unit configuration
    │   │       └── beans.xml                  # CDI activation descriptor
    │   │
    │   └── webapp/
    │       └── WEB-INF/
    │           ├── web.xml                    # Standard deployment descriptor
    │           └── payara-resources.xml       # Payara Connection Pool & JMS Resources definition
    │
    └── src/
        └── test/
            └── java/
                └── com/
                    └── techmart/
                        └── service/           # Test Suites
                            ├── ProductServiceTest.java          # JUnit 5 + Mockito Unit Test
                            └── OrderServiceIntegrationTest.java # Arquillian Integration Test
```

---

## 10. Non-Functional Requirements (NFRs)

- **Performance**:
  - The system must process checkout requests in under 500ms.
  - Page rendering data must load in less than 200ms.
- **Scalability**:
  - Horizontal scaling via clustering is supported. Stateful session beans can replicate state across multiple Payara nodes.
  - Connection pooling allows up to 128 database connections, supporting over 10,000 active concurrent users.
- **Reliability & Availability**:
  - 99.9% uptime target.
  - JMS queues capture orders during system outages, guaranteeing zero data loss.
- **Maintainability**:
  - Standardized layered code separation.
  - Separation of JPA Entities, EJBs, JAX-RS REST resources, and MDB consumers.
- **Security**:
  - Session cookies configured with `HttpOnly` and `Secure` attributes to prevent Cross-Site Scripting (XSS) attacks.
  - Container-Managed Security controls REST endpoint access using standard roles.

---

## 11. Deployment & Operations Guide

### 11.1 Database Setup (PostgreSQL)
1. Install PostgreSQL 15+ locally or on a server.
2. Log into the database console and create a target database:
   ```sql
   CREATE DATABASE techmart_db;
   ```
3. Initialize the schema and seed data using the [schema.sql](file:///f:/Techmart/src/main/resources/schema.sql) script:
   ```bash
   psql -U postgres -d techmart_db -f f:/Techmart/src/main/resources/schema.sql
   ```

### 11.2 Building the Project
Navigate to the root directory containing `pom.xml` and run the Maven compile phase:
```bash
mvn clean package
```
This compiles the classes, executes unit tests, and generates `target/techmart-online.war`.

### 11.3 Payara Server 6 Configuration and Deployment
1. Download **Payara Server 6 Community Edition** (Full Platform).
2. Start the domain:
   ```bash
   asadmin start-domain
   ```
3. Copy the PostgreSQL JDBC driver JAR (e.g. `postgresql-42.6.0.jar`) to the Payara library directory:
   - `payara6/glassfish/domains/domain1/lib/ext/`
   - Restart the server domain so Payara registers the driver.
4. **Resources Auto-provisioning**:
   - The project includes the [payara-resources.xml](file:///f:/Techmart/src/main/webapp/WEB-INF/payara-resources.xml) configuration.
   - When deploying the WAR, Payara reads this file and automatically provisions the `jdbc/TechMartDS` datasource pool, JMS Connection Factory, Queues, and Topic!
5. Deploy the WAR file via the Admin GUI (at `http://localhost:4848`) or using `asadmin` CLI:
   ```bash
   asadmin deploy target/techmart-online.war
   ```

### 11.4 Running in IntelliJ IDEA
1. Open IntelliJ IDEA and choose **File > Open**, then select the `TechMart` root directory.
2. Ensure Maven imports all dependencies.
3. Configure Payara Server:
   - Go to **Run > Edit Configurations...**
   - Click **+** and choose **Glassfish Server > Local** (or **Payara Server** plugin if installed).
   - Set the application server path to your Payara 6 directory.
   - In the **Deployment** tab, add `techmart-online:war` artifact.
   - Click **Run** to compile, boot Payara, provision resources, and deploy the application.

### 11.5 Verification API Scenarios (cURL Calls)

#### 1. List Catalog Products
```bash
curl -X GET http://localhost:8080/techmart-online/api/products
```

#### 2. Add Smartphone (ID: 1) and Coffee Maker (ID: 3) to cart
```bash
curl -X POST "http://localhost:8080/techmart-online/api/cart/add?productId=1&quantity=1"
curl -X POST "http://localhost:8080/techmart-online/api/cart/add?productId=3&quantity=2"
```

#### 3. View Session Cart
```bash
curl -X GET http://localhost:8080/techmart-online/api/cart
```

#### 4. Place Order (Checkout)
This call decrements stock from PostgreSQL, saves the order details, publishes to `OrderProcessingQueue` and `CustomerNotificationTopic`, triggers `OrderProcessingMDB` and `NotificationMDB` in the background, and returns the order.
```bash
curl -X POST "http://localhost:8080/techmart-online/api/orders/checkout?userId=1&shippingAddress=55+TechMart+Blvd+Colombo"
```

#### 5. Verify Asynchronous Payment (Gateway Timeout Scenario)
Simulate slow gateway validation. If the request completes under 4s, it returns Success. If it takes longer, it handles the timeout gracefully and alerts the client.
```bash
curl -X POST "http://localhost:8080/techmart-online/api/orders/1/payment?amount=1139.99"
```
