#import "ReleaseHub.h"
#import <React/RCTBridge.h>

@implementation ReleaseHub

RCT_EXPORT_MODULE(ReleaseHubModule);

+ (NSURL *)bundleURL {
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
    NSString *documentsDirectory = [paths objectAtIndex:0];
    NSString *baseDir = [documentsDirectory stringByAppendingPathComponent:@"release-hub"];
    NSString *statusPath = [baseDir stringByAppendingPathComponent:@"status.json"];
    
    NSURL *defaultBundleURL = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
    
    if (![[NSFileManager defaultManager] fileExistsAtPath:statusPath]) {
        return defaultBundleURL;
    }
    
    NSData *data = [NSData dataWithContentsOfFile:statusPath];
    if (!data) {
        return defaultBundleURL;
    }
    
    NSError *error = nil;
    NSMutableDictionary *status = [NSJSONSerialization JSONObjectWithData:data
                                                                   options:NSJSONReadingMutableContainers
                                                                     error:&error];
    if (error || !status) {
        return defaultBundleURL;
    }
    
    NSString *pendingHash = status[@"pendingHash"];
    NSString *currentHash = status[@"currentHash"];
    NSMutableArray *failedHashes = status[@"failedHashes"];
    if (!failedHashes) {
        failedHashes = [NSMutableArray array];
    }
    
    if (pendingHash && ![pendingHash isEqual:[NSNull null]] && pendingHash.length > 0) {
        NSString *bootingFile = [baseDir stringByAppendingPathComponent:[NSString stringWithFormat:@".booting-%@", pendingHash]];
        
        if ([[NSFileManager defaultManager] fileExistsAtPath:bootingFile]) {
            // CRASH DETECTED: booting file exists, meaning app restarted before notifyApplicationReady could be called
            NSLog(@"[ReleaseHub] App crash detected on previous launch for version %@. Rolling back.", pendingHash);
            
            [failedHashes addObject:pendingHash];
            status[@"failedHashes"] = failedHashes;
            status[@"pendingHash"] = [NSNull null];
            
            NSData *updatedData = [NSJSONSerialization dataWithJSONObject:status options:NSJSONWritingPrettyPrinted error:nil];
            if (updatedData) {
                [updatedData writeToFile:statusPath atomically:YES];
            }
            
            [[NSFileManager defaultManager] removeItemAtPath:bootingFile error:nil];
            
            if (currentHash && ![currentHash isEqual:[NSNull null]] && currentHash.length > 0) {
                NSString *bundlePath = [baseDir stringByAppendingPathComponent:[NSString stringWithFormat:@"packages/%@/main.jsbundle", currentHash]];
                if ([[NSFileManager defaultManager] fileExistsAtPath:bundlePath]) {
                    return [NSURL fileURLWithPath:bundlePath];
                }
            }
            return defaultBundleURL;
        } else {
            // First time loading the pending hash. Create booting file.
            [[NSFileManager defaultManager] createFileAtPath:bootingFile contents:nil attributes:nil];
            
            NSString *bundlePath = [baseDir stringByAppendingPathComponent:[NSString stringWithFormat:@"packages/%@/main.jsbundle", pendingHash]];
            if ([[NSFileManager defaultManager] fileExistsAtPath:bundlePath]) {
                return [NSURL fileURLWithPath:bundlePath];
            }
        }
    }
    
    if (currentHash && ![currentHash isEqual:[NSNull null]] && currentHash.length > 0) {
        NSString *bundlePath = [baseDir stringByAppendingPathComponent:[NSString stringWithFormat:@"packages/%@/main.jsbundle", currentHash]];
        if ([[NSFileManager defaultManager] fileExistsAtPath:bundlePath]) {
            return [NSURL fileURLWithPath:bundlePath];
        }
    }
    
    return defaultBundleURL;
}

RCT_EXPORT_METHOD(reload) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[NSNotificationCenter defaultCenter] postNotificationName:RCTReloadNotification object:nil];
    });
}

@end
