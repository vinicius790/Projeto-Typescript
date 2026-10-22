# Database Performance & Query Optimization Strategies

This document outlines advanced indexing and partitioning strategies for PostgreSQL (and Prisma ORM) based on the `schema.prisma` definitions.

## 1. B-Tree Indexes
B-Tree indexes are ideal for equality and range queries (`=`, `<`, `>`, `BETWEEN`, `IN`).
- **Existing**: `@@index([prototypeId, recordedAt])` on `PrototypeRevision`, `@@index([familyId])` and `@@index([userId])` on `RefreshToken`, `@@index([resetAt])` on `LoginAttempt`.
- **Recommendations**:
  - Add B-Tree index on `Prototype(createdAt)` for chronological sorting and range filtering on prototypes.
  - Add B-Tree index on `User(role)` if role-based filtering or listing is frequent.

## 2. Partial Indexes
Partial indexes index only a subset of rows satisfying a condition (`WHERE`), drastically reducing index size and maintenance overhead.
- **Recommendations**:
  - **Active / Unrevoked Refresh Tokens**:
    ```sql
    CREATE INDEX idx_refresh_tokens_active ON "RefreshToken" ("userId") WHERE "revokedAt" IS NULL;
    ```
    *Benefit*: Speeds up active session lookup while ignoring revoked tokens.
  - **First Admin / Unique Admin Constraint**:
    ```sql
    CREATE UNIQUE INDEX idx_user_first_admin ON "User" ("firstAdmin") WHERE "firstAdmin" = true;
    ```
    *Benefit*: Ensures only one user can be marked as the initial admin without locking all null rows.

## 3. GiST & GIN Indexes for Full-Text Search
For efficient text searching on `Prototype.name` or `CircularReference.label`:
- **GIN (Generalized Inverted Index)**: Best for static full-text search using `tsvector`.
  ```sql
  CREATE INDEX idx_prototype_name_gin ON "Prototype" USING gin (to_tsvector('portuguese', name));
  ```
- **GiST**: Suitable when index size or update speed is a bottleneck compared to GIN.

## 4. Partitioning Strategies
For high-volume tables like `PrototypeRevision` and `LoginAttempt`:
- **Range Partitioning on `PrototypeRevision`**:
  Partition by `recordedAt` (e.g., monthly or yearly partitions) to speed up archival and cleanup queries.
  ```sql
  CREATE TABLE "PrototypeRevision" (
      -- columns...
  ) PARTITION BY RANGE (recordedAt);
  ```
- **Hash Partitioning on `LoginAttempt`**:
  Partition by hash of `key` to distribute write load during peak login attempts.
