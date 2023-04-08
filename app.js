const express = require("express");

const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initialization = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("the server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`db error : ${e.message}`);
  }
};
initialization();

//api 1 i think this is easy lets see

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const searchQuery = `SELECT * FROM user WHERE username = "${username}";`;

  const dbUser = await db.get(searchQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isCorrectPass = await bcrypt.compare(password, dbUser.password);
    if (isCorrectPass === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "my secret key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authentication = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "my secret key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//api 2 get states

const convertObjectToResponsiveObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const districtResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.get("/states/", authentication, async (request, response) => {
  const Query = `SELECT * FROM state;`;
  const states = await db.all(Query);
  response.send(states.map((state) => convertObjectToResponsiveObject(state)));
});

//api 3 get state by id;

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const specifiedQuery = `SELECT * FROM state WHERE state_id ="${stateId}";`;
  const specifiedState = await db.get(specifiedQuery);
  response.send(convertObjectToResponsiveObject(specifiedState));
});

//api 3 adding district to table

app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const PostQuery = `
            INSERT INTO 
                district(district_name,state_id,cases,cured,active,deaths)
            VALUES
                ("${districtName}","${stateId}","${cases}","${cured}","${active}","${deaths}");`;
  await db.run(PostQuery);
  response.send("District Successfully Added");
});

//next api 5

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const specifiedQuery = `SELECT * FROM district WHERE district_id ="${districtId}";`;
    const specifiedDistrict = await db.get(specifiedQuery);
    response.send(districtResponse(specifiedDistrict));
  }
);

//api 6 delete

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const specifiedQuery = `DELETE FROM district WHERE district_id ="${districtId}";`;
    const specifiedDistrict = await db.run(specifiedQuery);
    response.send("District Removed");
  }
);

//api 7

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
            UPDATE 
                district
            SET
                district_name = "${districtName}",
                state_id = ${stateId},
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}
            WHERE district_id = ${districtId};
                
    `;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT
      SUM(cases),
      SUM(cured),
      SUM(active),
      SUM(deaths)
    FROM
      district
    WHERE
      state_id=${stateId};`;
    const stats = await db.get(getStateStatsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
