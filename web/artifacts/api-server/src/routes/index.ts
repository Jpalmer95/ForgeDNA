import { Router, type IRouter } from "express";
import healthRouter from "./health";
import schemasRouter from "./schemas";
import authRouter from "./auth";
import parseRouter from "./parse";
import aiBuildRouter from "./ai-build";
import cloudBuildRouter from "./cloud-build";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(schemasRouter);
router.use(parseRouter);
router.use(aiBuildRouter);
router.use(cloudBuildRouter);

export default router;
