import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Flag,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useHQ } from "../store";
import { Badge, PageHeader, Progress } from "../components/ui";
import type { Task } from "../types";
import "./Library.css";

const steps = [
  {
    id: "team",
    title: "Find your people",
    time: "1 min",
    description:
      "Your student lead helps you pick a small first job. Your mentor is your go-to for safety and questions.",
    Icon: HeartHandshake,
    action: "Meet your team",
    page: "settings" as const,
  },
  {
    id: "learn",
    title: "Learn one useful thing",
    time: "2 min",
    description:
      "Start with a beginner guide. You don’t need to understand the whole robot to contribute.",
    Icon: BookOpen,
    action: "Open beginner resources",
    page: "resources" as const,
  },
  {
    id: "task",
    title: "Make one thing better",
    time: "10 min",
    description:
      "Claim a small task with a clear finish line. Ask someone to work with you the first time.",
    Icon: Wrench,
    action: "Claim my first task",
    page: "tasks" as const,
  },
  {
    id: "document",
    title: "Leave a trail for your team",
    time: "2 min",
    description:
      "Add a task comment: what you tried, what happened, and what the next person should know.",
    Icon: ClipboardCheck,
    action: "Open my tasks",
    page: "tasks" as const,
  },
  {
    id: "safety",
    title: "Build confidence, safely",
    time: "With a mentor",
    description:
      "Ask a mentor before using tools or powering a mechanism. They can sign off your skills below.",
    Icon: ShieldCheck,
    action: "View safety resources",
    page: "resources" as const,
  },
];
const skills = [
  {
    id: "shop-safety",
    name: "Shop & tool safety",
    detail: "Know the team’s workshop rules and when to ask for help.",
  },
  {
    id: "battery-safety",
    name: "Battery handling",
    detail: "Connect, disconnect, store, and inspect a battery with a mentor.",
  },
  {
    id: "robot-startup",
    name: "Robot startup",
    detail: "Follow the startup checklist and find the emergency stop.",
  },
  {
    id: "first-task",
    name: "First documented task",
    detail: "Finish a small contribution and explain what you learned.",
  },
];

export default function OnboardingPage() {
  const {
    data,
    setData,
    setPage,
    openRecord,
    saveRecord,
    notify,
    canReview,
    canManage,
  } = useHQ();
  const complete = steps.filter((step) =>
    data.onboarding.includes(step.id),
  ).length;
  const firstResource = data.resources.find(
    (r) => r.level === "Beginner" && r.approved && r.visibility !== "private",
  );
  const firstTask = data.tasks.find(
    (t) => t.owner === "Alex (you)" && t.status !== "Done",
  );
  function toggle(id: string) {
    setData((s) => ({
      ...s,
      onboarding: s.onboarding.includes(id)
        ? s.onboarding.filter((x) => x !== id)
        : [...s.onboarding, id],
    }));
  }
  function claimTask() {
    if (firstTask) {
      notify(
        "You already have a next step. Open your task to see its finish line.",
      );
      openRecord("tasks", firstTask.id);
      return;
    }
    const unassigned = data.tasks.find(
      (t) =>
        ["Unassigned", "Team", ""].includes(t.owner) && t.status !== "Done",
    );
    if (unassigned && canManage) {
      saveRecord("tasks", { ...unassigned, owner: "Alex (you)" });
      notify("Your first task is assigned. You’ve got this.");
      openRecord("tasks", unassigned.id);
      return;
    }
    const task: Task = {
      id: crypto.randomUUID(),
      teamId: data.teamId,
      seasonId: data.seasonId,
      demo: false,
      title: "Complete a robot walkaround with a teammate",
      owner: "Alex (you)",
      area: "Robot design",
      due: new Date().toLocaleDateString("en-CA"),
      priority: "Low",
      status: "To do",
      done: "Identify the drivetrain, controller, and battery. Add one thing you learned and one question in a task comment.",
      effort: "10 min",
      description:
        "Ask a teammate or mentor to walk around the robot with you. Keep the robot powered off. Read a beginner resource first if one is available.",
      dependencies: [],
      resourceId: firstResource?.id,
      comments: [],
    };
    saveRecord("tasks", task);
    notify("Your first task is ready: a 10-minute robot walkaround.");
    openRecord("tasks", task.id);
  }
  function openStep(step: (typeof steps)[number]) {
    if (step.id === "task") {
      claimTask();
      return;
    }
    if (step.id === "document" && firstTask) {
      openRecord("tasks", firstTask.id);
      return;
    }
    if (step.id === "learn" && firstResource) {
      openRecord("resources", firstResource.id);
      return;
    }
    setPage(step.page);
  }
  return (
    <>
      <PageHeader
        eyebrow="YOU BELONG HERE"
        title="Your first five minutes"
        description="No experience needed. Start small, ask questions, and build something together."
      />
      <div className="rookie-welcome">
        <div className="rookie-spark">
          <Sparkles size={30} />
        </div>
        <div>
          <Badge tone="green">A good place to start</Badge>
          <h2>Everyone starts with a first step.</h2>
          <p>
            You don’t have to know everything. You just need a little curiosity
            and a teammate.
          </p>
          <div className="rookie-progress">
            <Progress value={(complete / steps.length) * 100} />
            <span>
              {Math.min(complete, steps.length)} of {steps.length} steps
              explored
            </span>
          </div>
        </div>
      </div>
      <div className="rookie-layout">
        <div className="stack rookie-steps">
          {steps.map((step, index) => {
            const done = data.onboarding.includes(step.id);
            return (
              <section
                key={step.id}
                className={`card rookie-step ${done ? "rookie-step-done" : ""}`}
              >
                <button
                  className="rookie-step-check"
                  aria-label={`${done ? "Mark incomplete" : "Mark explored"}: ${step.title}`}
                  aria-pressed={done}
                  onClick={() => toggle(step.id)}
                >
                  {done ? <CheckCircle2 size={25} /> : <span>{index + 1}</span>}
                </button>
                <div className="rookie-step-body">
                  <div className="inline">
                    <h2>{step.title}</h2>
                    <span className="muted rookie-time">{step.time}</span>
                  </div>
                  <p>{step.description}</p>
                  <button
                    className="btn btn-ghost"
                    onClick={() => openStep(step)}
                  >
                    {step.action}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        <aside className="stack">
          <section className="card rookie-next">
            <span className="resource-icon">
              <Compass size={24} />
            </span>
            <h2>Your next useful thing</h2>
            {firstTask ? (
              <>
                <p>{firstTask.title}</p>
                <div className="rookie-done-condition">
                  <strong>You’re done when…</strong>
                  <p>{firstTask.done}</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => openRecord("tasks", firstTask.id)}
                >
                  Open my task <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <p>
                  A ten-minute robot walkaround is a great way to get started.
                </p>
                <button className="btn btn-primary" onClick={claimTask}>
                  Find my first task <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
          <section className="card rookie-tip">
            <HeartHandshake size={23} />
            <h3>“Can you show me?” is a good question.</h3>
            <p>
              Your teammates started here, too. Ask your student lead or mentor
              for a partner on your first task.
            </p>
          </section>
        </aside>
      </div>
      <section className="card skills-passport">
        <div className="card-header">
          <div>
            <div className="eyebrow">GROW AT YOUR OWN PACE</div>
            <h2>My skills passport</h2>
            <p className="muted">
              Small milestones. A mentor’s encouragement. No leaderboards.
            </p>
          </div>
          <Badge tone="green">{data.skills.length} skills signed off</Badge>
        </div>
        <div className="skills-grid">
          {skills.map((skill) => {
            const signed = data.skills.includes(skill.id);
            return (
              <div
                className={`skill-item ${signed ? "skill-signed" : ""}`}
                key={skill.id}
              >
                {signed ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
                <div>
                  <strong>{skill.name}</strong>
                  <p>{skill.detail}</p>
                  {canReview ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setData((s) => ({
                          ...s,
                          skills: s.skills.includes(skill.id)
                            ? s.skills.filter((x) => x !== skill.id)
                            : [...s.skills, skill.id],
                        }));
                        notify(
                          signed
                            ? "Mentor sign-off removed."
                            : "Skill signed off. Celebrate that progress!",
                        );
                      }}
                    >
                      {signed ? "Remove sign-off" : "Mentor: sign off skill"}
                      {!signed && <Check size={14} />}
                    </button>
                  ) : (
                    <span className="skill-label">
                      {signed
                        ? "Signed off by a mentor"
                        : "Practice with a mentor"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {complete >= steps.length && (
        <div className="library-note rookie-finished">
          <Flag size={20} />
          <div>
            <strong>You’ve found your feet.</strong>
            <p>Keep exploring, or head home for your next step.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setPage("home")}>
            Back to home <ArrowRight size={16} />
          </button>
        </div>
      )}
    </>
  );
}
