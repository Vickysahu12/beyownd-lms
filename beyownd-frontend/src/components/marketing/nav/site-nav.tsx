import { getPublishedCourses } from "@/lib/catalog.server";
import { NavBar } from "./nav-bar";

/** Server wrapper: programs come from the cached catalog, the bar itself is a client island. */
export async function SiteNav() {
  const courses = await getPublishedCourses();
  return <NavBar courses={courses} />;
}
