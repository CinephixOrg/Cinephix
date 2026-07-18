async function testHost(host) {
  try {
    console.log(`Testing host: ${host}`);
    const loginRes = await fetch(`http://${host}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test1@email.com",
        password: "test123"
      })
    });
    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error(loginData.message || "Login failed");
    }
    const token = loginData.data.token;
    console.log(`[${host}] Logged in successfully. Token obtained.`);

    const analysisRes = await fetch(`http://${host}/api/users/profile-analysis`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const analysisData = await analysisRes.json();
    console.log(`[${host}] Response status:`, analysisRes.status);
    console.log(`[${host}] Response data:`, JSON.stringify(analysisData, null, 2));
    return true;
  } catch (err) {
    console.error(`[${host}] Failed:`, err.message);
    return false;
  }
}

async function main() {
  const hosts = ["[::1]:5000", "localhost:5000", "127.0.0.1:5000"];
  for (const host of hosts) {
    const success = await testHost(host);
    if (success) break;
  }
}

main();
