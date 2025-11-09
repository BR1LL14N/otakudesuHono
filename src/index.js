import { Hono } from "hono";
import { cors } from "hono/cors";
import * as cheerio from "cheerio";

const app = new Hono();

// Enable CORS
app.use("/*", cors());

// Base URL
const baseUrl = "https://otakudesu.best/";

// Helper function untuk format response
const formatResponse = (status, message, data, meta = {}) => {
  return {
    status: status,
    message: message,
    data: data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
};

// Helper function untuk fetch dengan retry
const fetchWithRetry = async (url, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempt ${i + 1} for ${url}`);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          Referer: baseUrl,
        },
      });

      if (response.ok) {
        return response;
      }

      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
      }
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
};

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Welcome To Unofficial Otakudesu REST API",
    createdBy: "KaedeNoKi Team ♥️",
    version: "2.0",
    endpoints: {
      home: "/api/home",
      complete: "/api/complete",
      ongoing: "/api/ongoing/page/:page",
      animeList: "/api/anime-list",
      search: "/api/search/:query",
      detail: "/api/anime/:id",
      batch: "/api/batch/:id",
      episode: "/api/eps/:id",
    },
  });
});

// Home endpoint
app.get("/api/home", async (c) => {
  try {
    const response = await fetchWithRetry(baseUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const element = $(".venz");
    let on_going = [];
    let complete = [];

    // Parse ongoing anime
    element
      .children()
      .eq(0)
      .find("ul > li")
      .each(function () {
        let title, thumb, link, id, episode, uploaded_on, day_updated;

        $(this)
          .find(".thumb > a")
          .filter(function () {
            title = $(this).find(".thumbz > h2").text();
            thumb = $(this).find(".thumbz > img").attr("src");
            link = $(this).attr("href");
            id = link.replace(`${baseUrl}anime/`, "").replace(/\/$/, "");
          });

        uploaded_on = $(this).find(".newnime").text();
        episode = $(this).find(".epz").text().replace(" ", "");
        day_updated = $(this).find(".epztipe").text().replace(" ", "");

        on_going.push({
          title,
          id,
          thumb,
          episode,
          uploaded_on,
          day_updated,
          link,
        });
      });

    // Parse complete anime
    element
      .children()
      .eq(1)
      .find("ul > li")
      .each(function () {
        let title, thumb, link, id, episode, uploaded_on, score;

        $(this)
          .find(".thumb > a")
          .filter(function () {
            title = $(this).find(".thumbz > h2").text();
            thumb = $(this).find(".thumbz > img").attr("src");
            link = $(this).attr("href");
            id = link.replace(`${baseUrl}anime/`, "").replace(/\/$/, "");
          });

        uploaded_on = $(this).find(".newnime").text();
        episode = $(this).find(".epz").text().replace(" ", "");
        score = parseFloat($(this).find(".epztipe").text().replace(" ", ""));

        complete.push({ title, id, thumb, episode, uploaded_on, score, link });
      });

    return c.json(
      formatResponse(
        "success",
        "Homepage data retrieved successfully",
        {
          on_going: { total: on_going.length, list: on_going },
          complete: { total: complete.length, list: complete },
        },
        { source_url: baseUrl }
      )
    );
  } catch (error) {
    return c.json(
      formatResponse("error", "Failed to fetch homepage data", null, {
        error: error.message,
      }),
      500
    );
  }
});

// Complete anime list
app.get("/api/complete", async (c) => {
  return c.redirect("/api/complete/page/1");
});

app.get("/api/complete/page/:page", async (c) => {
  const page = parseInt(c.req.param("page")) || 1;
  const pageParam = page === 1 ? "" : `page/${page}`;
  const fullUrl = `${baseUrl}complete-anime/${pageParam}`;

  try {
    const response = await fetchWithRetry(fullUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const element = $(".venz");
    let animeList = [];

    element
      .children()
      .eq(0)
      .find("ul > li")
      .each(function () {
        let title, thumb, link, id, episode, uploaded_on, score;

        $(this)
          .find(".thumb > a")
          .filter(function () {
            title = $(this).find(".thumbz > h2").text();
            thumb = $(this).find(".thumbz > img").attr("src");
            link = $(this).attr("href");
            id = link.replace(`${baseUrl}anime/`, "").replace(/\/$/, "");
          });

        uploaded_on = $(this).find(".newnime").text();
        episode = $(this).find(".epz").text().replace(" ", "");
        score = parseFloat($(this).find(".epztipe").text().replace(" ", ""));

        animeList.push({ title, id, thumb, episode, uploaded_on, score, link });
      });

    return c.json(
      formatResponse(
        "success",
        "Complete anime list retrieved successfully",
        { anime_list: animeList },
        {
          current_page: page,
          total_items: animeList.length,
          source_url: fullUrl,
          has_next_page: animeList.length > 0,
          next_page: animeList.length > 0 ? page + 1 : null,
        }
      )
    );
  } catch (error) {
    return c.json(
      formatResponse("error", "Failed to fetch complete anime list", null, {
        error: error.message,
      }),
      500
    );
  }
});

// Anime list (all)
app.get("/api/anime-list", async (c) => {
  const fullUrl = `${baseUrl}anime-list/`;

  try {
    const response = await fetchWithRetry(fullUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const allAnime = [];

    $(".bariskelom").each(function () {
      const letter = $(this).find(".barispenz a").text().trim();

      $(this)
        .find(".jdlbar ul li")
        .each(function () {
          const animeLink = $(this).find("a").attr("href");
          const animeTitle = $(this).find("a").text().trim();
          const fullTitle = $(this).find("a").attr("title");

          if (animeLink && animeTitle) {
            allAnime.push({
              title: animeTitle,
              full_title: fullTitle || animeTitle,
              id: animeLink.replace(`${baseUrl}anime/`, "").replace(/\/$/, ""),
              link: animeLink,
              letter: letter,
            });
          }
        });
    });

    // Group by letter
    const groupedByLetter = {};
    allAnime.forEach((anime) => {
      if (!groupedByLetter[anime.letter]) {
        groupedByLetter[anime.letter] = [];
      }
      groupedByLetter[anime.letter].push({
        title: anime.title,
        full_title: anime.full_title,
        id: anime.id,
        link: anime.link,
      });
    });

    return c.json(
      formatResponse(
        "success",
        "All anime list retrieved successfully",
        { anime_list: allAnime, grouped_by_letter: groupedByLetter },
        {
          source_url: fullUrl,
          total_anime: allAnime.length,
          total_letters: Object.keys(groupedByLetter).length,
        }
      )
    );
  } catch (error) {
    return c.json(
      formatResponse("error", "Failed to fetch anime list", null, {
        error: error.message,
        tip: "Try again in a few moments",
      }),
      500
    );
  }
});

// Search
app.get("/api/search/:query", async (c) => {
  const query = c.req.param("query").toLowerCase().trim();
  const fullUrl = `${baseUrl}anime-list/`;

  try {
    const response = await fetchWithRetry(fullUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const allAnime = [];

    $(".bariskelom").each(function () {
      const letter = $(this).find(".barispenz a").text().trim();

      $(this)
        .find(".jdlbar ul li")
        .each(function () {
          const animeLink = $(this).find("a").attr("href");
          const animeTitle = $(this).find("a").text().trim();
          const fullTitle = $(this).find("a").attr("title");

          if (animeLink && animeTitle) {
            allAnime.push({
              title: animeTitle,
              full_title: fullTitle || animeTitle,
              id: animeLink.replace(`${baseUrl}anime/`, "").replace(/\/$/, ""),
              link: animeLink,
              letter: letter,
            });
          }
        });
    });

    // Filter
    const searchResults = allAnime.filter((anime) => {
      const titleMatch = anime.title.toLowerCase().includes(query);
      const idMatch = anime.id.toLowerCase().includes(query);
      return titleMatch || idMatch;
    });

    // Sort by relevance
    searchResults.sort((a, b) => {
      const aExact =
        a.title.toLowerCase() === query || a.id.toLowerCase() === query;
      const bExact =
        b.title.toLowerCase() === query || b.id.toLowerCase() === query;
      if (aExact) return -1;
      if (bExact) return 1;
      return a.title.length - b.title.length;
    });

    return c.json(
      formatResponse(
        "success",
        searchResults.length > 0
          ? `Found ${searchResults.length} anime matching "${query}"`
          : `No anime found matching "${query}"`,
        { search_results: searchResults },
        {
          query: query,
          total_results: searchResults.length,
          total_anime_checked: allAnime.length,
        }
      )
    );
  } catch (error) {
    return c.json(
      formatResponse("error", "Failed to search anime", null, {
        error: error.message,
        query: query,
      }),
      500
    );
  }
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      status: "not found",
      message:
        "Endpoint not found. Check documentation at https://github.com/BR1LL14N/APIotakudesu",
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json(
    {
      status: "error",
      message: err.message,
    },
    500
  );
});

export default app;
