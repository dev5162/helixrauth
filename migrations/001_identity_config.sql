IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Products (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Slug nvarchar(100) NOT NULL UNIQUE,
    Name nvarchar(200) NOT NULL,
    App_Base_Url nvarchar(500) NOT NULL,
    Created_At datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Updated_At datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
  )
END
GO

IF OBJECT_ID(N'dbo.ProductRedirectOrigins', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductRedirectOrigins (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Product_ID int NOT NULL,
    Origin nvarchar(500) NOT NULL,
    CONSTRAINT FK_ProductRedirectOrigins_Products FOREIGN KEY (Product_ID) REFERENCES dbo.Products(ID),
    CONSTRAINT UQ_ProductRedirectOrigins_Product_Origin UNIQUE (Product_ID, Origin)
  )
END
GO

IF OBJECT_ID(N'dbo.ProductEntraConfigs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductEntraConfigs (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Product_ID int NOT NULL,
    Client_ID uniqueidentifier NOT NULL,
    ClientSecretRef nvarchar(500) NOT NULL,
    AuthorityTenant uniqueidentifier NOT NULL,
    Scopes nvarchar(max) NOT NULL,
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ProductEntraConfigs_Products FOREIGN KEY (Product_ID) REFERENCES dbo.Products(ID),
    CONSTRAINT UQ_ProductEntraConfigs_Product UNIQUE (Product_ID)
  )
END
GO

IF OBJECT_ID(N'dbo.ProductRoleMappings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductRoleMappings (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Product_ID int NOT NULL,
    Entra_Role nvarchar(200) NOT NULL,
    Gateway_Role nvarchar(200) NOT NULL,
    CONSTRAINT FK_ProductRoleMappings_Products FOREIGN KEY (Product_ID) REFERENCES dbo.Products(ID),
    CONSTRAINT UQ_ProductRoleMappings_Product_Role UNIQUE (Product_ID, Entra_Role)
  )
END
GO

IF OBJECT_ID(N'dbo.TenantPRoductAccess', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TenantPRoductAccess (
    ID int IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Product_ID int NOT NULL,
    Tenant_ID uniqueidentifier NOT NULL,
    Tenant_Name nvarchar(200) NOT NULL,
    Status nvarchar(50) NOT NULL,
    Approved_By nvarchar(200) NULL,
    Approved_At datetime2 NULL,
    CONSTRAINT FK_TenantPRoductAccess_Products FOREIGN KEY (Product_ID) REFERENCES dbo.Products(ID),
    CONSTRAINT UQ_TenantPRoductAccess_Product_Tenant UNIQUE (Product_ID, Tenant_ID)
  )
END
GO

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLogs (
    ID bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ActorID uniqueidentifier NULL,
    Action nvarchar(100) NOT NULL,
    TargetType nvarchar(100) NOT NULL,
    TargetID nvarchar(100) NOT NULL,
    Metadata nvarchar(max) NOT NULL,
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
  )
END
GO
