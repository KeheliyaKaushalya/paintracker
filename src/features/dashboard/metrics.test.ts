import { describe, expect, it } from "vitest";
import type { PatientFull, Round } from "../../domain/clinical/models";
import { dashboardGroups, painDistribution, painTrends } from "./metrics";
const date="2026-11-27";
const round=(id:string,rest:number|null,amended_of:string|null=null)=>({id,kind:"pain",round_date:date,round_time:"10:00",created_at:date,pain_rest:rest,pain_move:null,amended_of,tags:[]} as unknown as Round);
const patient=(rounds:Round[])=>({id:"p",ward:"7A",full_name:"Test",rounds,patient_alerts:[],patient_meds:[],has_epidural:false} as unknown as PatientFull);
describe("dashboard",()=>{
 it("excludes superseded assessments",()=>{const p=patient([round("a",9),round("b",2,"a")]);expect(dashboardGroups([p],date).severe).toHaveLength(0);expect(painTrends([p],[date])[0].rest).toEqual({mean:2,n:1});});
 it("distinguishes missing from zero",()=>{expect(painDistribution([patient([]),patient([round("a",0)])])).toEqual({low:1,mid:0,high:0,missing:1});});
 it("counts daily coverage without a schedule",()=>{expect(dashboardGroups([patient([]),patient([round("a",3)])],date).assessed).toHaveLength(1);});
});
