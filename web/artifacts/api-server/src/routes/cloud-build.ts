import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gameSchemasTable, schemaBuildsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.post("/cloud-build", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { schemaId, platform } = req.body;
  if (!schemaId || !platform) {
    res.status(400).json({ error: "schemaId and platform are required" });
    return;
  }

  const validPlatforms = ["webxr", "apk"];
  if (!validPlatforms.includes(platform)) {
    res.status(400).json({ error: `platform must be one of: ${validPlatforms.join(", ")}` });
    return;
  }

  const [schema] = await db
    .select()
    .from(gameSchemasTable)
    .where(and(eq(gameSchemasTable.id, schemaId), eq(gameSchemasTable.userId, req.user.id)));

  if (!schema) {
    res.status(404).json({ error: "Schema not found or not owned by you" });
    return;
  }

  const [build] = await db
    .insert(schemaBuildsTable)
    .values({
      schemaId,
      status: "queued",
      buildLog: JSON.stringify([
        { ts: new Date().toISOString(), msg: `Cloud build queued for ${platform}` },
        { ts: new Date().toISOString(), msg: "Note: Cloud Godot export is simulated in this environment" },
      ]),
    })
    .returning();

  setTimeout(async () => {
    try {
      const simulatedUrl = platform === "webxr"
        ? `https://forgedna.example.com/play/${schema.slug}`
        : `https://forgedna.example.com/builds/${build.id}/game.apk`;

      await db
        .update(schemaBuildsTable)
        .set({
          status: "complete",
          ...(platform === "webxr" ? { webxrUrl: simulatedUrl } : { apkUrl: simulatedUrl }),
          buildLog: JSON.stringify([
            { ts: new Date().toISOString(), msg: `Cloud build queued for ${platform}` },
            { ts: new Date().toISOString(), msg: "Simulating Godot headless export..." },
            { ts: new Date().toISOString(), msg: `Build complete: ${simulatedUrl}` },
          ]),
        })
        .where(eq(schemaBuildsTable.id, build.id));

      if (platform === "webxr") {
        await db
          .update(gameSchemasTable)
          .set({ webxrUrl: simulatedUrl, updatedAt: new Date() })
          .where(eq(gameSchemasTable.id, schemaId));
      }
    } catch (err) {
      console.error("Simulated cloud build error:", err);
      await db
        .update(schemaBuildsTable)
        .set({ status: "error", buildLog: JSON.stringify([{ ts: new Date().toISOString(), msg: "Build failed" }]) })
        .where(eq(schemaBuildsTable.id, build.id));
    }
  }, 3000);

  res.status(201).json({
    buildId: build.id,
    status: "queued",
    message: "Cloud build queued. Poll GET /api/cloud-build/:buildId for status.",
  });
});

router.get("/cloud-build/:buildId", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const buildId = parseInt(req.params.buildId, 10);
  if (isNaN(buildId)) {
    res.status(404).json({ error: "Build not found" });
    return;
  }

  const [build] = await db
    .select()
    .from(schemaBuildsTable)
    .where(eq(schemaBuildsTable.id, buildId));

  if (!build) {
    res.status(404).json({ error: "Build not found" });
    return;
  }

  const [schema] = await db
    .select({ userId: gameSchemasTable.userId })
    .from(gameSchemasTable)
    .where(eq(gameSchemasTable.id, build.schemaId));

  if (!schema || schema.userId !== req.user.id) {
    res.status(404).json({ error: "Build not found" });
    return;
  }

  res.json({
    buildId: build.id,
    schemaId: build.schemaId,
    status: build.status,
    webxrUrl: build.webxrUrl,
    apkUrl: build.apkUrl,
    buildLog: build.buildLog ? JSON.parse(build.buildLog as string) : [],
    createdAt: build.createdAt,
  });
});

export default router;
