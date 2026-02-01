// ============================================================================
// Gatling Load Test Generator (Scala)
// ============================================================================

import type { BehaviorSLA, InputFieldSpec } from '../ast-types';
import {
  generateGatlingSmokeScenario,
  generateGatlingLoadScenario,
  generateGatlingStressScenario,
  generateGatlingSpikeScenario,
  generateGatlingSoakScenario,
  type ScenarioType,
} from '../scenarios';

export interface GatlingOptions {
  baseUrl: string;
  scenarios: ScenarioType[];
  packageName?: string;
  simulationName?: string;
}

/**
 * Generate complete Gatling Scala simulation
 */
export function generateGatlingSimulation(behaviors: BehaviorSLA[], options: GatlingOptions): string {
  const packageName = options.packageName || 'loadtest';
  const simulationName = options.simulationName || 'LoadTestSimulation';
  
  const lines: string[] = [];

  // Package and imports
  lines.push(generateGatlingImports(packageName));
  lines.push('');

  // Simulation class
  lines.push(`class ${simulationName} extends Simulation {`);
  lines.push('');

  // HTTP configuration
  lines.push(generateHttpConfig(options.baseUrl));
  lines.push('');

  // Feeders for test data
  lines.push(generateGatlingFeeders(behaviors));
  lines.push('');

  // Behavior chains
  for (const behavior of behaviors) {
    lines.push(generateBehaviorChain(behavior));
    lines.push('');
  }

  // Combined chain
  lines.push(generateCombinedChain(behaviors));
  lines.push('');

  // Assertions
  lines.push(generateGatlingAssertions(behaviors));
  lines.push('');

  // Scenarios
  lines.push(getGatlingScenarios(options.scenarios));
  lines.push('');

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate Gatling imports
 */
function generateGatlingImports(packageName: string): string {
  return `package ${packageName}

import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._
import java.util.UUID
import java.time.Instant`;
}

/**
 * Generate HTTP configuration
 */
function generateHttpConfig(baseUrl: string): string {
  return `  val httpProtocol = http
    .baseUrl("${baseUrl}")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .userAgentHeader("Gatling LoadTest")
    .shareConnections`;
}

/**
 * Generate feeders for test data
 */
function generateGatlingFeeders(behaviors: BehaviorSLA[]): string {
  const generators = new Set<string>();
  
  for (const behavior of behaviors) {
    for (const field of behavior.inputFields) {
      generators.add(field.generator);
    }
  }

  const lines: string[] = ['  // Test data feeders'];

  lines.push(`  val randomFeeder = Iterator.continually(Map(
    "randomEmail" -> s"user_\${System.currentTimeMillis()}_\${scala.util.Random.alphanumeric.take(8).mkString}@loadtest.local",
    "randomUuid" -> UUID.randomUUID().toString,
    "randomString" -> scala.util.Random.alphanumeric.take(10).mkString,
    "randomNumber" -> scala.util.Random.nextInt(1000),
    "randomBoolean" -> scala.util.Random.nextBoolean(),
    "timestamp" -> Instant.now().toString
  ))`);

  return lines.join('\n');
}

/**
 * Generate behavior chain
 */
function generateBehaviorChain(behavior: BehaviorSLA): string {
  const chainName = toCamelCase(behavior.name) + 'Chain';
  const endpoint = `/api/${toKebabCase(behavior.name)}`;
  
  const lines: string[] = [];
  lines.push(`  val ${chainName} = `);
  lines.push(`    feed(randomFeeder)`);
  lines.push(`    .exec(`);
  lines.push(`      http("${behavior.name}")`);
  lines.push(`        .post("${endpoint}")`);
  lines.push(`        .body(StringBody("""{`);
  
  // Build JSON body
  const jsonFields = behavior.inputFields.map(field => {
    const value = getGatlingFeederValue(field);
    return `          "${field.name}": ${value}`;
  });
  lines.push(jsonFields.join(',\n'));
  
  lines.push(`        }""")).asJson`);
  lines.push(`        .check(status.in(${behavior.successCodes.join(', ')}))`);
  lines.push(`        .check(responseTimeInMillis.lte(${behavior.thresholds[behavior.thresholds.length - 1]?.durationMs || 1000}))`);
  lines.push(`    )`);

  // Add pause for rate limiting
  if (behavior.rateLimits.length > 0) {
    const rateLimit = behavior.rateLimits[0];
    const pauseMs = Math.ceil((rateLimit.periodSeconds * 1000) / rateLimit.count);
    lines.push(`    .pause(${pauseMs}.milliseconds)`);
  } else {
    lines.push('    .pause(500.milliseconds)');
  }

  return lines.join('\n');
}

/**
 * Generate combined chain for all behaviors
 */
function generateCombinedChain(behaviors: BehaviorSLA[]): string {
  const chainNames = behaviors.map(b => toCamelCase(b.name) + 'Chain');
  return `  val behaviorChain = ${chainNames.join('.exec(')}${')'.repeat(chainNames.length - 1)}`;
}

/**
 * Generate Gatling assertions
 */
function generateGatlingAssertions(behaviors: BehaviorSLA[]): string {
  const lines: string[] = ['  // Assertions from ISL SLAs'];
  
  lines.push('  val assertions = Seq(');
  
  const assertionLines: string[] = [];
  
  // Global assertions
  assertionLines.push('    global.failedRequests.percent.lt(1.0)');
  
  // Per-behavior assertions
  for (const behavior of behaviors) {
    for (const threshold of behavior.thresholds) {
      assertionLines.push(
        `    details("${behavior.name}").responseTime.percentile(${threshold.percentile}).lt(${threshold.durationMs})`
      );
    }
  }
  
  lines.push(assertionLines.join(',\n'));
  lines.push('  )');
  
  return lines.join('\n');
}

/**
 * Get Gatling scenarios
 */
function getGatlingScenarios(scenarios: ScenarioType[]): string {
  const scenarioCode: string[] = [];
  
  for (const scenario of scenarios) {
    switch (scenario) {
      case 'smoke':
        scenarioCode.push(generateGatlingSmokeScenario());
        break;
      case 'load':
        scenarioCode.push(generateGatlingLoadScenario());
        break;
      case 'stress':
        scenarioCode.push(generateGatlingStressScenario());
        break;
      case 'spike':
        scenarioCode.push(generateGatlingSpikeScenario());
        break;
      case 'soak':
        scenarioCode.push(generateGatlingSoakScenario());
        break;
    }
  }

  // If no scenarios, use load by default
  if (scenarioCode.length === 0) {
    scenarioCode.push(generateGatlingLoadScenario());
  }

  return scenarioCode.join('\n\n');
}

/**
 * Get Gatling feeder value for field
 */
function getGatlingFeederValue(field: InputFieldSpec): string {
  switch (field.generator) {
    case 'email':
      return '"${randomEmail}"';
    case 'uuid':
      return '"${randomUuid}"';
    case 'string':
      return '"${randomString}"';
    case 'number':
      return '${randomNumber}';
    case 'boolean':
      return '${randomBoolean}';
    case 'timestamp':
      return '"${timestamp}"';
    default:
      return '"${randomString}"';
  }
}

/**
 * Generate Gatling build.sbt
 */
export function generateGatlingBuildSbt(options: GatlingOptions): string {
  const packageName = options.packageName || 'loadtest';
  
  return `enablePlugins(GatlingPlugin)

scalaVersion := "2.13.12"

name := "${packageName}"
version := "0.1.0"

libraryDependencies ++= Seq(
  "io.gatling.highcharts" % "gatling-charts-highcharts" % "3.9.5" % "test",
  "io.gatling"            % "gatling-test-framework"    % "3.9.5" % "test"
)
`;
}

/**
 * Generate Gatling project plugins.sbt
 */
export function generateGatlingPluginsSbt(): string {
  return `addSbtPlugin("io.gatling" % "gatling-sbt" % "4.3.2")
`;
}

/**
 * Convert to camelCase
 */
function toCamelCase(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Convert to kebab-case
 */
function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}
