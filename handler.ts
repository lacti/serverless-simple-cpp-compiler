import { APIGatewayProxyHandler } from "aws-lambda";
import { execFile } from "child_process";
import * as fs from "fs-extra";
import * as os from "os";
import * as pTime from "p-time";
import * as pTimeout from "p-timeout";
import * as path from "path";
import { sync as rimraf } from "rimraf";
import "source-map-support/register";
// import { decompress } from "targz";
import * as timeSpan from "time-span";
import { v4 as uuidv4 } from "uuid";

const ccWorkspaceName = "cc-workspace";

const extern = (file: string, args: readonly string[]) =>
  new Promise<{
    stdout: string | Buffer;
    stderr: string | Buffer;
  }>((resolve, reject) =>
    execFile(file, args, { encoding: "utf-8" }, (error, stdout, stderr) =>
      error
        ? reject(error)
        : resolve({
            stdout,
            stderr
          })
    )
  );

const predefined = `
#include <iostream>
#include <vector>
#include <map>
#include <unordered_map>
#include <algorithm>
using namespace std;
`;

const sample = `
#include <iostream>
int main(int argc, char* argv[]) {
  std::cout << "hello world" << std::endl;
  return 0;
}
`;

export const exes = [
  "./libexec/gcc/x86_64-linux-musl/9.1.0/liblto_plugin.la",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/collect2",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/install-tools/fixinc.sh",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/install-tools/mkinstalldirs",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/install-tools/mkheaders",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/install-tools/fixincl",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/cc1plus",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/f951",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/lto1",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/cc1",
  "./libexec/gcc/x86_64-linux-musl/9.1.0/lto-wrapper",
  "./lib/libssp.so.0.0.0",
  "./lib/libgfortran.la",
  "./lib/libatomic.la",
  "./lib/libstdc++.so.6.0.26",
  "./lib/libitm.la",
  "./lib/libc.so",
  "./lib/libssp.la",
  "./lib/libbfd.la",
  "./lib/libitm.so.1.0.0",
  "./lib/libopcodes.la",
  "./lib/libssp_nonshared.la",
  "./lib/libgomp.la",
  "./lib/gcc/x86_64-linux-musl/9.1.0/libcaf_single.la",
  "./lib/libstdc++.la",
  "./lib/libstdc++fs.la",
  "./lib/libatomic.so.1.2.0",
  "./lib/libgomp.so.1.0.0",
  "./lib/libsupc++.la",
  "./lib/libgfortran.so.5.0.0",
  "./bin/c++filt",
  "./bin/x86_64-linux-musl-c++",
  "./bin/ld.bfd",
  "./bin/size",
  "./bin/ranlib",
  "./bin/ar",
  "./bin/c++",
  "./bin/gcc-nm",
  "./bin/as",
  "./bin/x86_64-linux-musl-gcc-ar",
  "./bin/nm",
  "./bin/x86_64-linux-musl-g++",
  "./bin/readelf",
  "./bin/objcopy",
  "./bin/gcov",
  "./bin/g++",
  "./bin/gcov-dump",
  "./bin/gfortran",
  "./bin/cpp",
  "./bin/ld",
  "./bin/gprof",
  "./bin/x86_64-linux-musl-gfortran",
  "./bin/addr2line",
  "./bin/x86_64-linux-musl-gcc-ranlib",
  "./bin/gcov-tool",
  "./bin/objdump",
  "./bin/gcc-ranlib",
  "./bin/strings",
  "./bin/strip",
  "./bin/x86_64-linux-musl-gcc",
  "./bin/elfedit",
  "./bin/gcc",
  "./bin/x86_64-linux-musl-gcc-nm",
  "./bin/x86_64-linux-musl-gcc-9.1.0",
  "./bin/gcc-ar",
  "./x86_64-linux-musl/bin/ld.bfd",
  "./x86_64-linux-musl/bin/ranlib",
  "./x86_64-linux-musl/bin/ar",
  "./x86_64-linux-musl/bin/as",
  "./x86_64-linux-musl/bin/nm",
  "./x86_64-linux-musl/bin/readelf",
  "./x86_64-linux-musl/bin/objcopy",
  "./x86_64-linux-musl/bin/ld",
  "./x86_64-linux-musl/bin/objdump",
  "./x86_64-linux-musl/bin/strip"
];

export const run: APIGatewayProxyHandler = async event => {
  const tmpDir = os.tmpdir();
  const ccWorkspace = path.join(tmpDir, ccWorkspaceName);

  const time = {
    prepare: 0,
    compile: 0,
    execute: 0
  };

  // Init by decompress
  // const ccVersion = "x86_64-linux-musl-native";
  // const ccPath = path.join(tmpDir, ccVersion);
  // if (!fs.existsSync(ccPath)) {
  //   const prepareTimesapn = timeSpan();
  //   console.log(`Install cc`);
  //   await new Promise<void>((resolve, reject) =>
  //     decompress(
  //       {
  //         src: `${ccVersion}.tgz`,
  //         dest: tmpDir
  //       },
  //       error => (error ? reject(error) : resolve())
  //     )
  //   );
  //   time.prepare = prepareTimesapn();
  //   console.log(`Install elapsed: ${time.prepare}ms`);
  // }

  // Init by copy
  const ccPath = path.join(tmpDir, "cc");
  if (!fs.existsSync(ccPath)) {
    const prepareTimespan = timeSpan();
    console.log(`Install cc`);
    fs.copySync("cc", ccPath);

    console.log(`Cover executable permissions`);
    for (const exe of exes) {
      console.log(`Give executable to ${exe}`);
      try {
        fs.chmodSync(path.join(ccPath, exe), "755");
      } catch (error) {
        console.log(`Cannot give a permission`, error);
      }
    }
    time.prepare = prepareTimespan();
    console.log(`Install elapsed: ${time.prepare}ms`);
  }

  const gccPath = path.join(ccPath, `bin`, `g++`);
  if (fs.existsSync(ccWorkspace)) {
    rimraf(ccWorkspace);
  }
  fs.mkdirSync(ccWorkspace);

  const id = uuidv4();
  const sourceFile = path.join(ccWorkspace, `${id}.cpp`);
  const body = event.body ? predefined + event.body : sample;
  fs.writeFileSync(sourceFile, body, "utf-8");

  const compileTimeout = 5000;
  const executeFile = path.join(ccWorkspace, `${id}.out`);
  try {
    const compilePromise = pTime(extern)(gccPath, [
      "-static",
      "-O3",
      sourceFile,
      "-o",
      executeFile
    ]);
    const compiled = await pTimeout(compilePromise, compileTimeout);
    time.compile = compilePromise.time;
    console.log(
      gccPath,
      sourceFile,
      executeFile,
      compiled,
      compilePromise.time
    );
  } catch (error) {
    rimraf(ccWorkspace);
    time.compile = compileTimeout;
    console.log(error);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      },
      body: JSON.stringify({ error: error.message, time })
    };
  }

  const executeTimeout = 10000;
  const executePromise = pTime(extern)(executeFile, []);
  try {
    const executed = await pTimeout(executePromise, executeTimeout);
    time.execute = executePromise.time;
    console.log(executeFile, executed, time.execute);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      },
      body: JSON.stringify({ ...executed, time }, null, 2)
    };
  } catch (error) {
    time.execute = executeTimeout;
    console.log(`execute-error`, error);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
      },
      body: JSON.stringify({ error: error.message, time }, null, 2)
    };
  } finally {
    rimraf(ccWorkspace);
  }
};

export const index: APIGatewayProxyHandler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/html"
    },
    body: `
<textarea id="code" cols="80" rows="24">
#include <iostream>

int main(int argc, char* argv[]) {
  std::cout << "hello world" << std::endl;
  return 0;
}
</textarea>
<button id="submit">Submit</button>
<pre id="result">Ready</pre>
<script type="text/javascript">
const $submit = document.getElementById('submit');
const $code = document.getElementById('code');
const $result = document.getElementById('result');

$submit.onclick = () => {
  $code.disabled = 'disabled';
  $submit.disabled = 'disabled';
  $result.innerText = 'Please waiting...';
  fetch('run', {
    method: 'POST',
    body: $code.value,
  }).then(r => r.text()).then(r => {
    $result.innerText = r;
    $code.disabled = undefined;
    $submit.disabled = undefined;
  }).catch(error => {
    console.error(error);
    $result.innerText = error;
    $code.disabled = undefined;
    $submit.disabled = undefined;
  });
}
</script>
`
  };
};
