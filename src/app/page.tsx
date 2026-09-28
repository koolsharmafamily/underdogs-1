import {
  ChapterCircle,
  ChapterDrop,
  ChapterHeadsTails,
  ChapterInside,
  ChapterKeeper,
  ChapterVault,
} from "@/components/home/Chapters";
import { HomeScroll } from "@/components/home/HomeScroll";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { listPublicNights } from "@/lib/domain/events";
import { getNextInnercircleTeaser, listPastNights } from "@/lib/domain/innercircle";
import { StageSlot } from "@/three/StageSlot";

/** The six-chapter journey. The coin is drawn into the "home" slot, behind everything. */
export default async function Home() {
  const db = await getDb();
  const actor = await getActor(db);
  const [next, nights, past] = await Promise.all([
    getNextInnercircleTeaser(db, actor),
    listPublicNights(db, actor),
    listPastNights(db, actor),
  ]);

  return (
    <>
      <StageSlot name="home" className="pointer-events-none fixed inset-0" />
      <HomeScroll />
      <ChapterVault />
      <ChapterHeadsTails />
      <ChapterDrop next={next} publicNights={nights.upcoming} />
      <ChapterCircle />
      <ChapterKeeper />
      <ChapterInside past={past} />
    </>
  );
}
