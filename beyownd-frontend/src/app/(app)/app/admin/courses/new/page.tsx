"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CourseForm } from "@/components/app/admin/course-form";
import { useToast } from "@/components/app/toast";
import { PageTitle } from "@/components/app/ui";
import { api } from "@/lib/api";
import { CLASSROOM_URL } from "@/lib/site";

export default function NewCoursePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageTitle title="New course" sub="It starts as a draft. Add modules and lessons, then publish." />
      <CourseForm
        submitLabel="Create draft"
        onSubmit={async (p) => {
          const res = await api<{ course: { _id: string } }>("/admin/courses", { method: "POST", body: p });
          qc.invalidateQueries({ queryKey: ["admin-courses"] });
          toast("success", "Draft created. Now add modules.");
          router.push(`${CLASSROOM_URL}/admin/courses/${res.course._id}`);
        }}
      />
    </>
  );
}
