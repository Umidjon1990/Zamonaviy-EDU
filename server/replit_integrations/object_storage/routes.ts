import type { Express, Request, Response, NextFunction } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import crypto from "crypto";

// Use session secret for HMAC signing - no fallback to ensure security
const getSigningSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is required for secure object path signing");
  }
  return secret;
};

// Sign an object path with tenant ID to prevent tampering
export function signObjectPath(objectPath: string, tenantId: number): string {
  const data = `${objectPath}:${tenantId}`;
  const signature = crypto.createHmac("sha256", getSigningSecret()).update(data).digest("hex").slice(0, 16);
  return `${objectPath}?t=${tenantId}&s=${signature}`;
}

// Verify a signed object path
export function verifyObjectPath(signedPath: string, tenantId: number): { valid: boolean; objectPath: string | null } {
  const match = signedPath.match(/^(.+)\?t=(\d+)&s=([a-f0-9]+)$/);
  if (!match) {
    return { valid: false, objectPath: null };
  }
  
  const [, objectPath, pathTenantId, signature] = match;
  
  // Verify tenant ID matches
  if (parseInt(pathTenantId, 10) !== tenantId) {
    return { valid: false, objectPath: null };
  }
  
  // Verify signature
  const data = `${objectPath}:${tenantId}`;
  const expectedSignature = crypto.createHmac("sha256", getSigningSecret()).update(data).digest("hex").slice(0, 16);
  
  if (signature !== expectedSignature) {
    return { valid: false, objectPath: null };
  }
  
  return { valid: true, objectPath };
}

/**
 * Register object storage routes for file uploads.
 *
 * This provides routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading (requires tenant auth)
 * 2. The client then uploads directly to the presigned URL
 *
 * All upload routes require tenant authentication for security.
 */
export function registerObjectStorageRoutes(app: Express): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Middleware to require tenant authentication for uploads
   */
  const requireTenantAuth = (req: Request, res: Response, next: NextFunction) => {
    const session = req.session as any;
    if (!session.tenantId || !session.userId) {
      return res.status(401).json({ error: "Avtorizatsiya talab qilinadi" });
    }
    next();
  };

  /**
   * Request a presigned URL for file upload.
   * REQUIRES TENANT AUTHENTICATION
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   *
   * Response:
   * {
   *   "uploadURL": "https://storage.googleapis.com/...",
   *   "objectPath": "/objects/uploads/uuid",
   *   "tenantId": 123
   * }
   *
   * IMPORTANT: The client should NOT send the file to this endpoint.
   * Send JSON metadata only, then upload the file directly to uploadURL.
   */
  app.post("/api/uploads/request-url", requireTenantAuth, async (req, res) => {
    try {
      const session = req.session as any;
      const tenantId = session.tenantId;
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      // Extract object path from the presigned URL for later reference
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      
      // Sign the object path with tenant ID using HMAC to prevent tampering
      const signedPath = signObjectPath(objectPath, tenantId);

      res.json({
        uploadURL,
        objectPath: signedPath,
        tenantId,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects.
   *
   * GET /objects/:objectPath(*)
   *
   * This serves files from object storage. For public files, no auth needed.
   * For protected files, add authentication middleware and ACL checks.
   */
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

