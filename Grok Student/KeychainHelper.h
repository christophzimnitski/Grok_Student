//
//  KeychainHelper.h
//  Grok Student
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface KeychainHelper : NSObject

+ (BOOL)saveAPIKey:(NSString *)apiKey forAPI:(NSString *)api;
+ (nullable NSString *)getAPIKeyForAPI:(NSString *)api;
+ (BOOL)deleteAPIKeyForAPI:(NSString *)api;

@end

NS_ASSUME_NONNULL_END
