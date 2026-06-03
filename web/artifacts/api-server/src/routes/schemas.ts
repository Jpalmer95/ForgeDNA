import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gameSchemasTable, schemaStarsTable, schemaVersionsTable } from "@workspace/db/schema";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";
import { getGameDnaJsonSchema, gameDnaSchema } from "@workspace/game-dna-schema";

const router: IRouter = Router();

const cachedJsonSchema = getGameDnaJsonSchema();

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const [existing] = await db
      .select({ id: gameSchemasTable.id })
      .from(gameSchemasTable)
      .where(eq(gameSchemasTable.slug, candidate));
    if (!existing) return candidate;
    suffix++;
  }
}

const starCountSubquery = db
  .select({
    schemaId: schemaStarsTable.schemaId,
    count: sql<number>`count(*)::int`.as("star_count"),
  })
  .from(schemaStarsTable)
  .groupBy(schemaStarsTable.schemaId)
  .as("star_counts");

router.get("/schemas", async (req, res) => {
  const { search, platform, genre, sort } = req.query;

  const conditions = [eq(gameSchemasTable.isPublic, true)];

  if (search && typeof search === "string" && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(gameSchemasTable.title, term),
        ilike(gameSchemasTable.vibePrompt, term),
        ilike(gameSchemasTable.goal, term),
      )!,
    );
  }

  if (genre && typeof genre === "string") {
    conditions.push(eq(gameSchemasTable.genreTag, genre));
  }

  let query = db
    .select({
      id: gameSchemasTable.id,
      userId: gameSchemasTable.userId,
      title: gameSchemasTable.title,
      slug: gameSchemasTable.slug,
      version: gameSchemasTable.version,
      vibePrompt: gameSchemasTable.vibePrompt,
      targetPlatforms: gameSchemasTable.targetPlatforms,
      goal: gameSchemasTable.goal,
      genreTag: gameSchemasTable.genreTag,
      isPublic: gameSchemasTable.isPublic,
      forkCount: gameSchemasTable.forkCount,
      forkedFromId: gameSchemasTable.forkedFromId,
      webxrUrl: gameSchemasTable.webxrUrl,
      createdAt: gameSchemasTable.createdAt,
      updatedAt: gameSchemasTable.updatedAt,
      starCount: sql<number>`coalesce(${starCountSubquery.count}, 0)`.as("star_count"),
    })
    .from(gameSchemasTable)
    .leftJoin(starCountSubquery, eq(gameSchemasTable.id, starCountSubquery.schemaId))
    .where(and(...conditions))
    .$dynamic();

  if (sort === "stars") {
    query = query.orderBy(sql`coalesce(${starCountSubquery.count}, 0) DESC`);
  } else if (sort === "forks") {
    query = query.orderBy(desc(gameSchemasTable.forkCount));
  } else {
    query = query.orderBy(desc(gameSchemasTable.createdAt));
  }

  const schemas = await query;

  if (platform && typeof platform === "string") {
    const filtered = schemas.filter((s) => {
      const platforms = s.targetPlatforms as string[];
      return platforms.some((p: string) => p.toLowerCase().includes(platform.toLowerCase()));
    });
    res.json(filtered);
    return;
  }

  res.json(schemas);
});

router.get("/schemas/game-dna", (_req, res) => {
  res.json(cachedJsonSchema);
});

router.get("/schemas/mine", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const schemas = await db
    .select({
      id: gameSchemasTable.id,
      userId: gameSchemasTable.userId,
      title: gameSchemasTable.title,
      slug: gameSchemasTable.slug,
      version: gameSchemasTable.version,
      vibePrompt: gameSchemasTable.vibePrompt,
      targetPlatforms: gameSchemasTable.targetPlatforms,
      goal: gameSchemasTable.goal,
      genreTag: gameSchemasTable.genreTag,
      isPublic: gameSchemasTable.isPublic,
      forkCount: gameSchemasTable.forkCount,
      forkedFromId: gameSchemasTable.forkedFromId,
      webxrUrl: gameSchemasTable.webxrUrl,
      createdAt: gameSchemasTable.createdAt,
      updatedAt: gameSchemasTable.updatedAt,
    })
    .from(gameSchemasTable)
    .where(eq(gameSchemasTable.userId, req.user.id));

  res.json(schemas);
});

router.post("/schemas", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { title, version, vibePrompt, targetPlatforms, goal, schemaData, isPublic, genreTag } = req.body;

    if (!title || !vibePrompt || !goal) {
      res.status(400).json({ error: "title, vibePrompt, and goal are required" });
      return;
    }

    if (!schemaData || typeof schemaData !== "object") {
      res.status(400).json({ error: "schemaData is required and must be an object" });
      return;
    }

    const validation = gameDnaSchema.safeParse(schemaData);
    if (!validation.success) {
      res.status(400).json({
        error: "Invalid GameDNA schema data",
        validationErrors: validation.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const slug = await uniqueSlug(title);

    const [schema] = await db
      .insert(gameSchemasTable)
      .values({
        userId: req.user.id,
        title,
        slug,
        version: version || "1.0",
        vibePrompt,
        targetPlatforms: targetPlatforms || [],
        goal,
        genreTag: genreTag || null,
        schemaData,
        isPublic: isPublic ?? true,
      })
      .returning();

    res.status(201).json(schema);
  } catch (err) {
    console.error("Error creating schema:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/schemas/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [schema] = await db
    .select()
    .from(gameSchemasTable)
    .where(eq(gameSchemasTable.id, id));

  if (!schema) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  if (!schema.isPublic) {
    if (!req.isAuthenticated() || req.user.id !== schema.userId) {
      res.status(404).json({ error: "Schema not found" });
      return;
    }
  }

  const [starRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schemaStarsTable)
    .where(eq(schemaStarsTable.schemaId, id));

  const userStarred = req.isAuthenticated()
    ? (await db.select({ id: schemaStarsTable.id }).from(schemaStarsTable).where(and(eq(schemaStarsTable.schemaId, id), eq(schemaStarsTable.userId, req.user.id)))).length > 0
    : false;

  res.json({ ...schema, starCount: starRow?.count || 0, userStarred });
});

router.put("/schemas/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(gameSchemasTable)
    .where(eq(gameSchemasTable.id, id));

  if (!existing || existing.userId !== req.user.id) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  try {
    const { title, version, vibePrompt, targetPlatforms, goal, schemaData, isPublic, genreTag } = req.body;

    if (schemaData !== undefined) {
      if (typeof schemaData !== "object" || schemaData === null) {
        res.status(400).json({ error: "schemaData must be an object" });
        return;
      }
      const validation = gameDnaSchema.safeParse(schemaData);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid GameDNA schema data",
          validationErrors: validation.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      await db.insert(schemaVersionsTable).values({
        schemaId: id,
        versionLabel: existing.version,
        schemaData: existing.schemaData,
        title: existing.title,
        changeNote: `Snapshot before update to v${version || existing.version}`,
      });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (version !== undefined) updates.version = version;
    if (vibePrompt !== undefined) updates.vibePrompt = vibePrompt;
    if (targetPlatforms !== undefined) updates.targetPlatforms = targetPlatforms;
    if (goal !== undefined) updates.goal = goal;
    if (schemaData !== undefined) updates.schemaData = schemaData;
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (genreTag !== undefined) updates.genreTag = genreTag;

    const [updated] = await db
      .update(gameSchemasTable)
      .set(updates)
      .where(eq(gameSchemasTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("Error updating schema:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/schemas/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(gameSchemasTable)
    .where(eq(gameSchemasTable.id, id));

  if (!existing || existing.userId !== req.user.id) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  await db.delete(gameSchemasTable).where(eq(gameSchemasTable.id, id));
  res.json({ success: true });
});

router.post("/schemas/:id/fork", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [source] = await db
    .select()
    .from(gameSchemasTable)
    .where(and(eq(gameSchemasTable.id, id), eq(gameSchemasTable.isPublic, true)));

  if (!source) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const slug = await uniqueSlug(source.title + "-remix");

  const [forked] = await db
    .insert(gameSchemasTable)
    .values({
      userId: req.user.id,
      title: source.title + " (Remix)",
      slug,
      version: "1.0",
      vibePrompt: source.vibePrompt,
      targetPlatforms: source.targetPlatforms,
      goal: source.goal,
      genreTag: source.genreTag,
      schemaData: source.schemaData,
      isPublic: false,
      forkedFromId: source.id,
    })
    .returning();

  await db
    .update(gameSchemasTable)
    .set({ forkCount: sql`${gameSchemasTable.forkCount} + 1` })
    .where(eq(gameSchemasTable.id, id));

  res.status(201).json(forked);
});

router.post("/schemas/:id/star", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [schema] = await db.select({ id: gameSchemasTable.id, isPublic: gameSchemasTable.isPublic, userId: gameSchemasTable.userId }).from(gameSchemasTable).where(eq(gameSchemasTable.id, id));
  if (!schema || (!schema.isPublic && schema.userId !== req.user.id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(schemaStarsTable)
    .where(and(eq(schemaStarsTable.schemaId, id), eq(schemaStarsTable.userId, req.user.id)));

  if (existing) {
    res.json({ starred: true, message: "Already starred" });
    return;
  }

  await db.insert(schemaStarsTable).values({ userId: req.user.id, schemaId: id });
  res.json({ starred: true });
});

router.delete("/schemas/:id/star", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [schema] = await db.select({ id: gameSchemasTable.id, isPublic: gameSchemasTable.isPublic, userId: gameSchemasTable.userId }).from(gameSchemasTable).where(eq(gameSchemasTable.id, id));
  if (!schema || (!schema.isPublic && schema.userId !== req.user.id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  await db
    .delete(schemaStarsTable)
    .where(and(eq(schemaStarsTable.schemaId, id), eq(schemaStarsTable.userId, req.user.id)));

  res.json({ starred: false });
});

router.get("/schemas/:id/versions", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [schema] = await db.select({ id: gameSchemasTable.id, userId: gameSchemasTable.userId, isPublic: gameSchemasTable.isPublic }).from(gameSchemasTable).where(eq(gameSchemasTable.id, id));
  if (!schema) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  if (!schema.isPublic && (!req.isAuthenticated() || req.user.id !== schema.userId)) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const versions = await db
    .select()
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.schemaId, id))
    .orderBy(desc(schemaVersionsTable.createdAt));

  res.json(versions);
});

router.post("/schemas/:id/versions/restore", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  const { versionId } = req.body;
  if (isNaN(id) || !versionId) {
    res.status(400).json({ error: "Schema id and versionId are required" });
    return;
  }

  const [schema] = await db.select().from(gameSchemasTable).where(eq(gameSchemasTable.id, id));
  if (!schema || schema.userId !== req.user.id) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  const [version] = await db
    .select()
    .from(schemaVersionsTable)
    .where(and(eq(schemaVersionsTable.id, versionId), eq(schemaVersionsTable.schemaId, id)));

  if (!version) {
    res.status(404).json({ error: "Version not found" });
    return;
  }

  await db.insert(schemaVersionsTable).values({
    schemaId: id,
    versionLabel: schema.version,
    schemaData: schema.schemaData,
    title: schema.title,
    changeNote: `Snapshot before restoring v${version.versionLabel}`,
  });

  const [restored] = await db
    .update(gameSchemasTable)
    .set({
      schemaData: version.schemaData,
      version: version.versionLabel,
      title: version.title || schema.title,
      updatedAt: new Date(),
    })
    .where(eq(gameSchemasTable.id, id))
    .returning();

  res.json(restored);
});

router.get("/play/:slug", async (req, res) => {
  const { slug } = req.params;

  const [schema] = await db
    .select({
      id: gameSchemasTable.id,
      title: gameSchemasTable.title,
      slug: gameSchemasTable.slug,
      vibePrompt: gameSchemasTable.vibePrompt,
      goal: gameSchemasTable.goal,
      webxrUrl: gameSchemasTable.webxrUrl,
      targetPlatforms: gameSchemasTable.targetPlatforms,
    })
    .from(gameSchemasTable)
    .where(and(eq(gameSchemasTable.slug, slug), eq(gameSchemasTable.isPublic, true)));

  if (!schema) {
    res.status(404).json({ error: "Schema not found" });
    return;
  }

  res.json(schema);
});

export default router;
