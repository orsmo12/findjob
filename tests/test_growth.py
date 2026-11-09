from agent_core.agents import growth as G


def test_cv_suggestions_only_from_repo_facts():
    G.act.log = lambda *a, **k: None
    ev = [{"repo": "findjob", "url": "https://github.com/x/findjob", "desc": "job agents", "files": ["requirements.txt: groq, httpx"],
           "langs": ["Python", "JavaScript"], "readme": "Agents run in GitHub Actions and the app is deployed on Vercel with Supabase.",
           "workflows": ["nightly.yml"]}]
    G.chat = lambda *a, **k: ('{"suggestions": [{"repo": "findjob", "line": "Built scheduled AI agents on GitHub Actions, deployed on Vercel with Supabase", '
                              '"where": "Projects", "why": "CI/CD", "proof": "nightly.yml"}, {"repo": "findjob", "line": "Deployed on Kubernetes serving 10,000 users", '
                              '"where": "Projects", "why": "x", "proof": "y"}, {"repo": "nope", "line": "Python", "where": "", "why": "", "proof": ""}]}')
    out = G.cv_suggestions("CV: Python projects", ev, ["CI/CD"])
    assert [s["line"][:5] for s in out] == ["Built"]          # Kubernetes ו-10,000 לא בריפו; ריפו שלא קיים נזרק


def test_skill_keywords_only_from_repo_and_new():
    G.act.log = lambda *a, **k: None
    ev = [{"repo": "findjob", "url": "https://github.com/x/findjob", "desc": "", "files": ["Dockerfile", "requirements.txt: httpx"],
           "langs": ["Python", "TypeScript"], "readme": "Deployed on Vercel with Supabase.", "workflows": []}]
    G.chat = lambda *a, **k: ('{"skills": [{"skill": "Supabase", "repo": "findjob", "why": "x"}, {"skill": "Python", "repo": "findjob"},'
                              '{"skill": "Kubernetes", "repo": "findjob"}, {"skill": "Docker", "repo": "findjob"}], "suggestions": []}')
    out = G.cv_suggestions("Skills: Python, React", ev, [])
    assert [(s["kind"], s["skill"]) for s in out] == [("skill", "Supabase"), ("skill", "Docker")]   # Python כבר כתוב, Kubernetes לא בריפו


def test_resources_only_known_sites():
    G._search = lambda q, n=8: [{"title": "Docker docs", "url": "https://docs.docker.com/get-started/", "text": ""},
                                {"title": "spam", "url": "https://random-blog.xyz/docker", "text": ""}]
    assert [r["site"] for r in G.resources("Docker")] == ["docs.docker.com"]
